import os
import json

data_filename = "training_data.jsonl"

# Comprehensive list of simulated video editor prompt-response pairs for structured intent extraction.
# This prevents memorization of specific float start/end coordinates by training the LLM to output
# only high-level intents and parameters, leaving mathematical operations to a deterministic Python resolver.
video_editor_examples = [
    {
        "metadata": "Name: vlog_entry_01.mp4\nType: video/mp4\nDuration: 60.0s\nResolution: 1920x1080\nPlayhead: 0.0s",
        "timeline": "Existing Cuts: []\nSilent Sections: [{\"start\": 10.5, \"end\": 15.2}]\nBackground Music: []",
        "request": "remove the silent gap in the beginning of the video",
        "intents": [
            {"intent": "remove_silent_sections"}
        ]
    },
    {
        "metadata": "Name: zoom_meeting.mp4\nType: video/mp4\nDuration: 180.0s\nResolution: 1280x720\nPlayhead: 45.0s",
        "timeline": "Existing Cuts: []\nSilent Sections: [{\"start\": 25.0, \"end\": 32.5}, {\"start\": 110.0, \"end\": 118.0}]\nBackground Music: []",
        "request": "cut out all the silent segments in this recording please",
        "intents": [
            {"intent": "remove_silent_sections"}
        ]
    },
    {
        "metadata": "Name: travel_vlog.mov\nType: video/quicktime\nDuration: 90.0s\nResolution: 1920x1080\nPlayhead: 0.0s",
        "timeline": "Existing Cuts: []\nSilent Sections: []\nBackground Music: []",
        "request": "add background music upbeat_track.mp3 to the entire video",
        "intents": [
            {"intent": "add_music", "track": "upbeat_track.mp3", "start": 0, "end": "duration"}
        ]
    },
    {
        "metadata": "Name: gameplay.mp4\nType: video/mp4\nDuration: 120.0s\nResolution: 1920x1080\nPlayhead: 15.0s",
        "timeline": "Existing Cuts: []\nSilent Sections: []\nBackground Music: []",
        "request": "mute the audio between 45 and 60 seconds to hide the background noise",
        "intents": [
            {"intent": "mute_segment", "start": 45, "end": 60}
        ]
    },
    {
        "metadata": "Name: intro_clip.mp4\nType: video/mp4\nDuration: 50.0s\nResolution: 1920x1080\nPlayhead: 0.0s",
        "timeline": "Existing Cuts: []\nSilent Sections: []\nBackground Music: []",
        "request": "trim off the first 5 seconds and the last 5 seconds of the video",
        "intents": [
            {"intent": "remove_segment", "position": "first", "duration_seconds": 5},
            {"intent": "remove_segment", "position": "last", "duration_seconds": 5}
        ]
    },
    {
        "metadata": "Name: cooking_tutorial.mp4\nType: video/mp4\nDuration: 300.0s\nResolution: 1920x1080\nPlayhead: 100.0s",
        "timeline": "Existing Cuts: [{\"start\": 0.0, \"end\": 10.0}]\nSilent Sections: [{\"start\": 150.0, \"end\": 165.5}]\nBackground Music: []",
        "request": "cut the quiet gap in the middle of the video",
        "intents": [
            {"intent": "remove_silent_sections"}
        ]
    },
    {
        "metadata": "Name: podcast_episode_1.mp4\nType: video/mp4\nDuration: 600.0s\nResolution: 1920x1080\nPlayhead: 0.0s",
        "timeline": "Existing Cuts: []\nSilent Sections: [{\"start\": 400.0, \"end\": 415.0}]\nBackground Music: []",
        "request": "mute the audio around 400 to 415 instead of cutting it, so we keep the video frame intact",
        "intents": [
            {"intent": "mute_segment", "start": 400, "end": 415}
        ]
    },
    {
        "metadata": "Name: outdoor_vlog.mp4\nType: video/mp4\nDuration: 75.0s\nResolution: 1920x1080\nPlayhead: 0.0s",
        "timeline": "Existing Cuts: []\nSilent Sections: []\nBackground Music: []",
        "request": "add acoustic_guitar.mp3 background music from 10 seconds to the end of the video",
        "intents": [
            {"intent": "add_music", "track": "acoustic_guitar.mp3", "start": 10, "end": "duration"}
        ]
    },
    {
        "metadata": "Name: speech_draft.mp4\nType: video/mp4\nDuration: 120.0s\nResolution: 1280x720\nPlayhead: 0.0s",
        "timeline": "Existing Cuts: []\nSilent Sections: [{\"start\": 0.0, \"end\": 4.5}, {\"start\": 115.0, \"end\": 120.0}]\nBackground Music: []",
        "request": "trim the silent parts at the very beginning and the end",
        "intents": [
            {"intent": "remove_silent_sections"}
        ]
    },
    {
        "metadata": "Name: unboxing.mov\nType: video/quicktime\nDuration: 240.0s\nResolution: 1920x1080\nPlayhead: 120.0s",
        "timeline": "Existing Cuts: []\nSilent Sections: []\nBackground Music: []",
        "request": "cut out the segment from minute 2 to minute 2.5",
        "intents": [
            {"intent": "cut_range", "start": "2:00", "end": "2:30"}
        ]
    },
    {
        "metadata": "Name: presentation.mp4\nType: video/mp4\nDuration: 150.0s\nResolution: 1920x1080\nPlayhead: 0.0s",
        "timeline": "Existing Cuts: []\nSilent Sections: [{\"start\": 85.0, \"end\": 92.3}]\nBackground Music: []",
        "request": "cut the quiet section and then add low_lofi.mp3 to the entire remaining video",
        "intents": [
            {"intent": "remove_silent_sections"},
            {"intent": "add_music", "track": "low_lofi.mp3", "start": 0, "end": "duration"}
        ]
    },
    {
        "metadata": "Name: blooper_reel.mp4\nType: video/mp4\nDuration: 90.0s\nResolution: 1920x1080\nPlayhead: 30.0s",
        "timeline": "Existing Cuts: []\nSilent Sections: []\nBackground Music: []",
        "request": "mute the audio from 35 to 42 seconds due to bad language",
        "intents": [
            {"intent": "mute_segment", "start": 35, "end": 42}
        ]
    },
    {
        "metadata": "Name: nature_broll.mp4\nType: video/mp4\nDuration: 40.0s\nResolution: 3840x2160\nPlayhead: 0.0s",
        "timeline": "Existing Cuts: []\nSilent Sections: []\nBackground Music: []",
        "request": "add wind_chimes.wav music overlay from 5s to 35s",
        "intents": [
            {"intent": "add_music", "track": "wind_chimes.wav", "start": 5, "end": 35}
        ]
    },
    {
        "metadata": "Name: review.mp4\nType: video/mp4\nDuration: 180.0s\nResolution: 1920x1080\nPlayhead: 10.0s",
        "timeline": "Existing Cuts: []\nSilent Sections: [{\"start\": 130.0, \"end\": 142.5}]\nBackground Music: []",
        "request": "remove that long silent period near the end of the video",
        "intents": [
            {"intent": "remove_silent_sections"}
        ]
    },
    {
        "metadata": "Name: long_interview.mp4\nType: video/mp4\nDuration: 300.0s\nResolution: 1920x1080\nPlayhead: 120.0s",
        "timeline": "Existing Cuts: []\nSilent Sections: []\nBackground Music: []",
        "request": "delete everything from the current playhead position to the very end of the video",
        "intents": [
            {"intent": "remove_from_playhead_to_end"}
        ]
    },
    {
        "metadata": "Name: podcast_master.mp4\nType: video/mp4\nDuration: 600.0s\nResolution: 1920x1080\nPlayhead: 0.0s",
        "timeline": "Existing Cuts: []\nSilent Sections: []\nBackground Music: []",
        "request": "cut out the portion from 1:15 to 1:45",
        "intents": [
            {"intent": "cut_range", "start": "1:15", "end": "1:45"}
        ]
    },
    {
        "metadata": "Name: marketing_clip.mp4\nType: video/mp4\nDuration: 60.0s\nResolution: 1920x1080\nPlayhead: 0.0s",
        "timeline": "Existing Cuts: []\nSilent Sections: []\nBackground Music: []",
        "request": "add intro_theme.wav for the first 10 seconds and outro_beat.mp3 for the last 10 seconds",
        "intents": [
            {"intent": "add_music", "track": "intro_theme.wav", "start": 0, "end": 10},
            {"intent": "add_music", "track": "outro_beat.mp3", "start": 50, "end": 60}
        ]
    },
    {
        "metadata": "Name: daily_vlog.mov\nType: video/quicktime\nDuration: 150.0s\nResolution: 1920x1080\nPlayhead: 20.0s",
        "timeline": "Existing Cuts: []\nSilent Sections: [{\"start\": 45.0, \"end\": 55.0}]\nBackground Music: []",
        "request": "cut the quiet section and also mute the audio from 80 to 95 seconds",
        "intents": [
            {"intent": "remove_silent_sections"},
            {"intent": "mute_segment", "start": 80, "end": 95}
        ]
    },
    {
        "metadata": "Name: tutorial.mp4\nType: video/mp4\nDuration: 120.0s\nResolution: 1280x720\nPlayhead: 5.0s",
        "timeline": "Existing Cuts: []\nSilent Sections: []\nBackground Music: []",
        "request": "mute the audio entirely for the first minute of this tutorial",
        "intents": [
            {"intent": "mute_segment", "start": 0, "end": 60}
        ]
    },
    
    # ─── USER SPECIFIED DIVERSE EXAMPLES ───
    {
        "metadata": "Name: short_vlog.mp4\nType: video/mp4\nDuration: 90.0s\nResolution: 1920x1080\nPlayhead: 0.0s",
        "timeline": "Existing Cuts: []\nSilent Sections: []\nBackground Music: []",
        "request": "cut intro",
        "intents": [
            {"intent": "remove_segment", "position": "intro", "duration_seconds": 10}
        ]
    },
    {
        "metadata": "Name: promo.mp4\nType: video/mp4\nDuration: 60.0s\nResolution: 1280x720\nPlayhead: 0.0s",
        "timeline": "Existing Cuts: []\nSilent Sections: []\nBackground Music: []",
        "request": "remove beginning",
        "intents": [
            {"intent": "remove_segment", "position": "beginning", "duration_seconds": 15}
        ]
    },
    {
        "metadata": "Name: demo.mov\nType: video/quicktime\nDuration: 120.0s\nResolution: 1920x1080\nPlayhead: 0.0s",
        "timeline": "Existing Cuts: []\nSilent Sections: []\nBackground Music: []",
        "request": "delete last 45 seconds",
        "intents": [
            {"intent": "remove_segment", "position": "last", "duration_seconds": 45}
        ]
    },
    {
        "metadata": "Name: interview.mp4\nType: video/mp4\nDuration: 300.0s\nResolution: 1920x1080\nPlayhead: 0.0s",
        "timeline": "Existing Cuts: []\nSilent Sections: []\nBackground Music: []",
        "request": "trim from 1:20 to 2:10",
        "intents": [
            {"intent": "cut_range", "start": "1:20", "end": "2:10"}
        ]
    },
    {
        "metadata": "Name: gameplay_full.mp4\nType: video/mp4\nDuration: 180.0s\nResolution: 1920x1080\nPlayhead: 0.0s",
        "timeline": "Existing Cuts: []\nSilent Sections: []\nBackground Music: []",
        "request": "remove middle section",
        "intents": [
            {"intent": "remove_segment", "position": "middle"}
        ]
    },
    {
        "metadata": "Name: zoom_meeting.mp4\nType: video/mp4\nDuration: 180.0s\nResolution: 1280x720\nPlayhead: 0.0s",
        "timeline": "Existing Cuts: []\nSilent Sections: [{\"start\": 25.0, \"end\": 32.5}]\nBackground Music: []",
        "request": "remove first 1 min",
        "intents": [
            {"intent": "remove_segment", "position": "first", "duration_seconds": 60}
        ]
    },
    {
        "metadata": "Name: zoom_meeting.mp4\nType: video/mp4\nDuration: 180.0s\nResolution: 1280x720\nPlayhead: 0.0s",
        "timeline": "Existing Cuts: []\nSilent Sections: [{\"start\": 25.0, \"end\": 32.5}]\nBackground Music: []",
        "request": "remove last 1 min",
        "intents": [
            {"intent": "remove_segment", "position": "last", "duration_seconds": 60}
        ]
    }
]

def format_chatml(system_prompt, user_content, response_content):
    """
    Format standard fields into SmolLM2's ChatML template string.
    """
    return {
        "text": f"<|im_start|>system\n{system_prompt}<|im_end|>\n<|im_start|>user\n{user_content}<|im_end|>\n<|im_start|>assistant\n{response_content}<|im_end|>"
    }

def main():
    print("=" * 70)
    print("     VIDEO EDITOR AI INPUT PAGE - TRAINING DATA PREPARATION")
    print("=" * 70)
    
    system_instruction = (
        "You are an intelligent video editor AI agent. Your sole task is to analyze the user's video editing "
        "request and return a raw JSON list of structured intents representing their instruction. "
        "Do not write any conversation, conversational greeting, or explanations. "
        "Output ONLY the raw valid JSON list."
    )

    print(f"Generating training dataset: '{data_filename}' with {len(video_editor_examples)} video editor examples...")
    
    with open(data_filename, "w", encoding="utf-8") as f:
        for ex in video_editor_examples:
            # Build the custom user prompt structure (clean workspace state)
            user_content = (
                f"[VIDEO METADATA]\n{ex['metadata']}\n\n"
                f"[TIMELINE STATE]\n{ex['timeline']}\n\n"
                f"[USER REQUEST]\n{ex['request']}"
            )
            
            # Format the target response output as strictly a JSON array of intents
            response_content = json.dumps(ex["intents"], indent=2)
            
            # Format ChatML string
            formatted = format_chatml(system_instruction, user_content, response_content)
            f.write(json.dumps(formatted) + "\n")
            
    print("✅ Video Editor dataset successfully created!")
    
    # Read and print the count of data samples
    count = 0
    with open(data_filename, "r", encoding="utf-8") as f:
        count = sum(1 for _ in f)
        
    print("\n" + "=" * 70)
    print(f"Dataset preparation complete! Total training samples: {count}")
    print(f"Data saved to: {os.path.abspath(data_filename)}")
    print("=" * 70)

if __name__ == "__main__":
    main()
