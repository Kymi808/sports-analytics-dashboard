"""Basketball clip analyzer using OpenCV and MediaPipe Pose estimation."""

import json
import math
import logging
from pathlib import Path
from typing import Optional

import cv2
import numpy as np

try:
    import mediapipe as mp
    MEDIAPIPE_AVAILABLE = True
except ImportError:
    MEDIAPIPE_AVAILABLE = False

logger = logging.getLogger(__name__)


def _angle_between(a, b, c) -> float:
    """Calculate angle at point b given three points (a, b, c).
    Each point is a tuple/list of (x, y)."""
    ba = (a[0] - b[0], a[1] - b[1])
    bc = (c[0] - b[0], c[1] - b[1])
    dot = ba[0] * bc[0] + ba[1] * bc[1]
    mag_ba = math.sqrt(ba[0] ** 2 + ba[1] ** 2)
    mag_bc = math.sqrt(bc[0] ** 2 + bc[1] ** 2)
    if mag_ba * mag_bc == 0:
        return 0.0
    cosine = max(-1.0, min(1.0, dot / (mag_ba * mag_bc)))
    return math.degrees(math.acos(cosine))


def _landmark_to_xy(landmark) -> tuple[float, float]:
    return (landmark.x, landmark.y)


def _detect_shot_attempt(landmarks) -> dict:
    """Detect a potential basketball shot attempt from pose landmarks.

    Heuristic: wrist is above shoulder, and arm is extended (elbow angle > 140 degrees).
    Returns a dict with detection info or None.
    """
    mp_pose = mp.solutions.pose

    # Check both arms
    for side in ["right", "left"]:
        if side == "right":
            shoulder = landmarks[mp_pose.PoseLandmark.RIGHT_SHOULDER]
            elbow = landmarks[mp_pose.PoseLandmark.RIGHT_ELBOW]
            wrist = landmarks[mp_pose.PoseLandmark.RIGHT_WRIST]
        else:
            shoulder = landmarks[mp_pose.PoseLandmark.LEFT_SHOULDER]
            elbow = landmarks[mp_pose.PoseLandmark.LEFT_ELBOW]
            wrist = landmarks[mp_pose.PoseLandmark.LEFT_WRIST]

        # Check visibility
        if shoulder.visibility < 0.5 or elbow.visibility < 0.5 or wrist.visibility < 0.5:
            continue

        # Wrist above shoulder (y decreases upward in image coords)
        wrist_above = wrist.y < shoulder.y

        # Arm extension angle
        elbow_angle = _angle_between(
            _landmark_to_xy(shoulder),
            _landmark_to_xy(elbow),
            _landmark_to_xy(wrist),
        )

        if wrist_above and elbow_angle > 140:
            return {
                "side": side,
                "elbow_angle": round(elbow_angle, 1),
                "wrist_height_relative": round(shoulder.y - wrist.y, 3),
            }

    return None


def _analyze_shot_form(landmarks) -> dict:
    """Analyze shot form quality based on pose landmarks."""
    mp_pose = mp.solutions.pose
    form_notes = []
    score = 100.0

    for side in ["right", "left"]:
        if side == "right":
            shoulder = landmarks[mp_pose.PoseLandmark.RIGHT_SHOULDER]
            elbow = landmarks[mp_pose.PoseLandmark.RIGHT_ELBOW]
            wrist = landmarks[mp_pose.PoseLandmark.RIGHT_WRIST]
            hip = landmarks[mp_pose.PoseLandmark.RIGHT_HIP]
        else:
            shoulder = landmarks[mp_pose.PoseLandmark.LEFT_SHOULDER]
            elbow = landmarks[mp_pose.PoseLandmark.LEFT_ELBOW]
            wrist = landmarks[mp_pose.PoseLandmark.LEFT_WRIST]
            hip = landmarks[mp_pose.PoseLandmark.LEFT_HIP]

        if any(lm.visibility < 0.5 for lm in [shoulder, elbow, wrist, hip]):
            continue

        # Check elbow alignment: elbow should be roughly under wrist (x-axis alignment)
        elbow_wrist_x_diff = abs(elbow.x - wrist.x)
        if elbow_wrist_x_diff > 0.08:
            form_notes.append(f"{side} elbow drifting outward (misalignment: {elbow_wrist_x_diff:.3f})")
            score -= 15

        # Check follow-through: wrist should extend above and forward of elbow
        if wrist.y < elbow.y:
            form_notes.append(f"{side} arm shows follow-through")
        else:
            form_notes.append(f"{side} arm lacks follow-through")
            score -= 10

        # Body alignment: shoulder over hip
        shoulder_hip_x_diff = abs(shoulder.x - hip.x)
        if shoulder_hip_x_diff > 0.1:
            form_notes.append(f"{side} body leaning (offset: {shoulder_hip_x_diff:.3f})")
            score -= 10

    return {
        "score": max(0.0, round(score, 1)),
        "notes": form_notes,
    }


def _classify_position_zone(landmarks, frame_width: int, frame_height: int) -> str:
    """Classify player position into court zones based on pose center."""
    mp_pose = mp.solutions.pose

    left_hip = landmarks[mp_pose.PoseLandmark.LEFT_HIP]
    right_hip = landmarks[mp_pose.PoseLandmark.RIGHT_HIP]

    if left_hip.visibility < 0.3 and right_hip.visibility < 0.3:
        return "unknown"

    cx = (left_hip.x + right_hip.x) / 2
    cy = (left_hip.y + right_hip.y) / 2

    # Divide frame into 3x3 grid zones
    col = "left" if cx < 0.33 else ("center" if cx < 0.66 else "right")
    row = "near" if cy > 0.66 else ("mid" if cy > 0.33 else "far")

    return f"{row}_{col}"


def _compute_movement_direction(prev_center, curr_center) -> str:
    """Classify movement as lateral or forward/back."""
    dx = curr_center[0] - prev_center[0]
    dy = curr_center[1] - prev_center[1]

    if abs(dx) > abs(dy):
        return "lateral"
    elif abs(dy) > 0.005:
        return "forward_back"
    else:
        return "stationary"


def analyze_basketball_clip(video_path: str, frame_interval: int = 10) -> dict:
    """Analyze a basketball clip and return structured results.

    Args:
        video_path: Path to the video file.
        frame_interval: Process every Nth frame. Lower = more detail but slower.

    Returns:
        Dict with analysis results including detected shots, movement data,
        pose quality, and activity metrics.
    """
    results = {
        "detected_shots": [],
        "shot_count": 0,
        "movement_heatmap_data": [],
        "movement_patterns": {"lateral": 0, "forward_back": 0, "stationary": 0},
        "pose_quality_scores": [],
        "position_zones": {},
        "general_activity_level": "unknown",
        "total_frames_processed": 0,
        "frames_with_person": 0,
        "shot_form_analyses": [],
        "errors": [],
    }

    if not MEDIAPIPE_AVAILABLE:
        results["errors"].append("MediaPipe not available. Install with: pip install mediapipe")
        return results

    if not Path(video_path).exists():
        results["errors"].append(f"Video file not found: {video_path}")
        return results

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        results["errors"].append(f"Could not open video: {video_path}")
        return results

    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    frame_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    frame_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    mp_pose = mp.solutions.pose
    pose = mp_pose.Pose(
        static_image_mode=False,
        model_complexity=1,
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5,
    )

    prev_center = None
    frame_idx = 0
    active_frames = 0

    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                break

            if frame_idx % frame_interval != 0:
                frame_idx += 1
                continue

            results["total_frames_processed"] += 1
            timestamp = frame_idx / fps

            # Convert BGR to RGB for MediaPipe
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

            try:
                pose_results = pose.process(rgb_frame)
            except Exception as e:
                logger.warning(f"Pose detection failed at frame {frame_idx}: {e}")
                frame_idx += 1
                continue

            if not pose_results.pose_landmarks:
                frame_idx += 1
                continue

            results["frames_with_person"] += 1
            landmarks = pose_results.pose_landmarks.landmark

            # Compute average landmark visibility as pose quality
            visibility_scores = [lm.visibility for lm in landmarks]
            avg_visibility = sum(visibility_scores) / len(visibility_scores)
            results["pose_quality_scores"].append({
                "timestamp": round(timestamp, 2),
                "quality": round(avg_visibility, 3),
            })

            # Heatmap: track hip center position
            left_hip = landmarks[mp_pose.PoseLandmark.LEFT_HIP]
            right_hip = landmarks[mp_pose.PoseLandmark.RIGHT_HIP]
            cx = (left_hip.x + right_hip.x) / 2
            cy = (left_hip.y + right_hip.y) / 2
            results["movement_heatmap_data"].append({
                "x": round(cx, 3),
                "y": round(cy, 3),
                "timestamp": round(timestamp, 2),
            })

            # Movement direction tracking
            curr_center = (cx, cy)
            if prev_center is not None:
                direction = _compute_movement_direction(prev_center, curr_center)
                results["movement_patterns"][direction] += 1
                if direction != "stationary":
                    active_frames += 1
            prev_center = curr_center

            # Position zone
            zone = _classify_position_zone(landmarks, frame_width, frame_height)
            results["position_zones"][zone] = results["position_zones"].get(zone, 0) + 1

            # Shot detection
            shot_info = _detect_shot_attempt(landmarks)
            if shot_info is not None:
                shot_record = {
                    "timestamp": round(timestamp, 2),
                    "frame": frame_idx,
                    **shot_info,
                }
                # Avoid duplicate detections for the same shot (within 0.5 seconds)
                if not results["detected_shots"] or (
                    timestamp - results["detected_shots"][-1]["timestamp"] > 0.5
                ):
                    results["detected_shots"].append(shot_record)

                    # Shot form analysis
                    form = _analyze_shot_form(landmarks)
                    form["timestamp"] = round(timestamp, 2)
                    results["shot_form_analyses"].append(form)

            frame_idx += 1

    except Exception as e:
        results["errors"].append(f"Analysis error: {str(e)}")
        logger.exception("Error during clip analysis")
    finally:
        cap.release()
        pose.close()

    results["shot_count"] = len(results["detected_shots"])

    # Determine general activity level
    processed = results["total_frames_processed"]
    if processed > 0:
        person_ratio = results["frames_with_person"] / processed
        if person_ratio < 0.2:
            results["general_activity_level"] = "minimal"
        elif active_frames / max(1, results["frames_with_person"]) > 0.6:
            results["general_activity_level"] = "high"
        elif active_frames / max(1, results["frames_with_person"]) > 0.3:
            results["general_activity_level"] = "moderate"
        else:
            results["general_activity_level"] = "low"

    return results
