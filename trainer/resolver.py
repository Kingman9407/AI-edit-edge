import json
import re

def parse_time_to_seconds(time_val, max_duration=None):
    """
    Converts a time value (float, int, or 'MM:SS' string, or 'duration' keyword) to float seconds.
    """
    if time_val is None:
        return 0.0
    if isinstance(time_val, (int, float)):
        return float(time_val)
    
    time_str = str(time_val).strip().lower()
    
    if time_str == "duration" or time_str == "end":
        return float(max_duration) if max_duration is not None else 0.0
        
    # Check for MM:SS or HH:MM:SS format
    match = re.match(r'^(?:(\d+):)?(\d+):(\d+(?:\.\d+)?)$', time_str)
    if match:
        hours = int(match.group(1)) if match.group(1) else 0
        minutes = int(match.group(2))
        seconds = float(match.group(3))
        return float(hours * 3600 + minutes * 60 + seconds)
        
    try:
        return float(time_str)
    except ValueError:
        return 0.0

def resolve_intent(intent, workspace_state):
    """
    Resolves a single intent dictionary into a list of executable timeline operations.
    
    workspace_state structure:
    {
        "duration": float,
        "playhead": float,
        "silent_sections": [{"start": float, "end": float}],
        "existing_cuts": [{"start": float, "end": float}]
    }
    """
    duration = float(workspace_state.get("duration", 180.0))
    playhead = float(workspace_state.get("playhead", 0.0))
    silent_sections = workspace_state.get("silent_sections", [])
    
    intent_type = intent.get("intent")
    operations = []
    
    if not intent_type:
        return []
        
    if intent_type == "remove_segment":
        position = intent.get("position", "first")
        dur_sec = parse_time_to_seconds(intent.get("duration_seconds"), duration)
        
        if position == "first" or position == "beginning" or position == "intro":
            start = 0.0
            end = min(dur_sec, duration)
            operations.append({
                "operation": "cut",
                "start": start,
                "end": end,
                "reason": f"Cut {position} segment ({dur_sec}s)"
            })
        elif position == "last" or position == "end" or position == "outro":
            start = max(0.0, duration - dur_sec)
            end = duration
            operations.append({
                "operation": "cut",
                "start": start,
                "end": end,
                "reason": f"Cut {position} segment ({dur_sec}s)"
            })
        elif position == "middle":
            # If duration_seconds is not specified, default to cut the middle third
            if dur_sec == 0.0:
                dur_sec = duration / 3.0
            start = max(0.0, (duration / 2.0) - (dur_sec / 2.0))
            end = min(duration, (duration / 2.0) + (dur_sec / 2.0))
            operations.append({
                "operation": "cut",
                "start": start,
                "end": end,
                "reason": f"Cut {position} segment ({dur_sec:.1f}s)"
            })
            
    elif intent_type == "remove_silent_sections":
        if not silent_sections:
            # Return a trace message or no operations
            pass
        else:
            for idx, section in enumerate(silent_sections):
                start = max(0.0, float(section.get("start", 0.0)))
                end = min(duration, float(section.get("end", 0.0)))
                if start < end:
                    operations.append({
                        "operation": "cut",
                        "start": start,
                        "end": end,
                        "reason": f"Cut silent section {idx + 1}"
                    })
                    
    elif intent_type == "cut_range":
        start = parse_time_to_seconds(intent.get("start"), duration)
        end = parse_time_to_seconds(intent.get("end"), duration)
        
        # Swapping logic if bounds are reversed
        if start > end:
            start, end = end, start
            
        # Clamp to bounds
        start = max(0.0, start)
        end = min(duration, end)
        
        if start < end:
            operations.append({
                "operation": "cut",
                "start": start,
                "end": end,
                "reason": f"Cut range from {start}s to {end}s"
            })
            
    elif intent_type == "mute_segment":
        start = parse_time_to_seconds(intent.get("start"), duration)
        end = parse_time_to_seconds(intent.get("end"), duration)
        
        if start > end:
            start, end = end, start
            
        start = max(0.0, start)
        end = min(duration, end)
        
        if start < end:
            operations.append({
                "operation": "mute",
                "start": start,
                "end": end,
                "reason": f"Mute audio from {start}s to {end}s"
            })
            
    elif intent_type == "add_music":
        track = intent.get("track", "background_music.mp3")
        start = parse_time_to_seconds(intent.get("start", 0.0), duration)
        end = parse_time_to_seconds(intent.get("end", "duration"), duration)
        
        if start > end:
            start, end = end, start
            
        start = max(0.0, start)
        end = min(duration, end)
        
        if start < end:
            operations.append({
                "operation": "add_audio_overlay",
                "start": start,
                "end": end,
                "reason": f"Overlay background music: {track}"
            })
            
    elif intent_type == "remove_from_playhead_to_end":
        start = max(0.0, playhead)
        end = duration
        if start < end:
            operations.append({
                "operation": "cut",
                "start": start,
                "end": end,
                "reason": f"Cut timeline from playhead ({start}s) to end ({end}s)"
            })
            
    return operations

def resolve_intents(intents_list, workspace_state):
    """
    Resolves a list of intents (or a single intent) and returns the final list of execution operations.
    """
    if isinstance(intents_list, dict):
        intents_list = [intents_list]
        
    all_operations = []
    for intent in intents_list:
        all_operations.extend(resolve_intent(intent, workspace_state))
    return all_operations
