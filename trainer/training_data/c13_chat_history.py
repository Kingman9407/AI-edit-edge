"""
Category 13 — Chat History

Goal: Train the model to use previous conversational context to resolve
      ambiguous follow-up requests like "do the same for..." or "cut that instead".

Note: The 'history' field is a list of prior {role, content} turns that
      precede the current input. The model must read it to understand "that",
      "the same", "instead", etc.
"""

examples = [
    # ── Example 1: "also do the same" ──────────────────────────────────────────
    {
        "input": "[VIDEO METADATA]\nName: demo.mp4\nDuration: 300.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- 0.0 -> 10.0\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nalso do the same for the last 10 seconds",
        "output": "{\"message\":\"Cut the last 10 seconds as well.\",\"operations\":[{\"operation\":\"cut\",\"variation\":\"last\",\"value\":10,\"unit\":\"seconds\",\"reason\":\"Cut last 10 seconds\"}]}",
        "history": [
            {
                "role": "user",
                "content": "[VIDEO METADATA]\nName: demo.mp4\nDuration: 300.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nremove first 10 seconds"
            },
            {
                "role": "assistant",
                "content": "{\"message\":\"Removed the first 10 seconds.\",\"operations\":[{\"operation\":\"cut\",\"variation\":\"first\",\"value\":10,\"unit\":\"seconds\",\"reason\":\"Remove first 10 seconds\"}]}"
            }
        ]
    },

    # ── Example 2: "cut that section out instead" ──────────────────────────────
    {
        "input": "[VIDEO METADATA]\nName: podcast.mp4\nDuration: 1200.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- 60.0 -> 120.0\n\nBackground Music:\n- None\n\n[USER REQUEST]\ncan you cut that section out completely instead?",
        "output": "{\"message\":\"Replaced the mute with a cut from 1 to 2 minutes.\",\"operations\":[{\"operation\":\"cut\",\"variation\":\"range\",\"start\":\"1:00\",\"end\":\"2:00\",\"unit\":\"seconds\",\"reason\":\"Replace mute with cut from 1 to 2 minutes\"}]}",
        "history": [
            {
                "role": "user",
                "content": "[VIDEO METADATA]\nName: podcast.mp4\nDuration: 1200.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nmute from 1 min to 2 min"
            },
            {
                "role": "assistant",
                "content": "{\"message\":\"Muted the audio from 1 to 2 minutes.\",\"operations\":[{\"operation\":\"mute\",\"variation\":\"range\",\"start\":\"1\",\"end\":\"2\",\"unit\":\"minutes\",\"reason\":\"Mute from 1 to 2 minutes\"}]}"
            }
        ]
    },

    # ── Example 3: Consecutive edits (Greeting -> Edit 1 -> Edit 2) ───────────
    {
        "input": "[VIDEO METADATA]\nName: gaming_highlights.mp4\nDuration: 300.0s\nResolution: 3840x2160\nPlayhead: 104.6s\n\n[TIMELINE STATE]\nCuts:\n- 0.0 -> 60.0\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nremove last 10 sec",
        "output": "{\"message\":\"Removed the last 10 seconds.\",\"operations\":[{\"operation\":\"cut\",\"variation\":\"last\",\"value\":10,\"unit\":\"seconds\",\"reason\":\"Remove last 10 seconds\"}]}",
        "history": [
            {
                "role": "user",
                "content": "[VIDEO METADATA]\nName: gaming_highlights.mp4\nDuration: 300.0s\nResolution: 3840x2160\nPlayhead: 104.6s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nhi"
            },
            {
                "role": "assistant",
                "content": "{\"message\":\"Hi! How can I help with your video today?\",\"operations\":[]}"
            },
            {
                "role": "user",
                "content": "[VIDEO METADATA]\nName: gaming_highlights.mp4\nDuration: 300.0s\nResolution: 3840x2160\nPlayhead: 104.6s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nremove first 1 min"
            },
            {
                "role": "assistant",
                "content": "{\"message\":\"Removed the first 1 minute.\",\"operations\":[{\"operation\":\"cut\",\"variation\":\"first\",\"value\":1,\"unit\":\"minutes\",\"reason\":\"Remove first 1 min\"}]}"
            }
        ]
    },

    # ── Example 4: Correction of the previous edit duration ──────────────────
    {
        "input": "[VIDEO METADATA]\nName: lecture.mp4\nDuration: 600.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- 0.0 -> 10.0\n\nBackground Music:\n- None\n\n[USER REQUEST]\nactually make it 15 seconds instead",
        "output": "{\"message\":\"Adjusted mute duration to the first 15 seconds.\",\"operations\":[{\"operation\":\"mute\",\"variation\":\"first\",\"value\":15,\"unit\":\"seconds\",\"reason\":\"Adjust mute to 15 seconds\"}]}",
        "history": [
            {
                "role": "user",
                "content": "[VIDEO METADATA]\nName: lecture.mp4\nDuration: 600.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nmute the first 10 seconds"
            },
            {
                "role": "assistant",
                "content": "{\"message\":\"Muted the first 10 seconds.\",\"operations\":[{\"operation\":\"mute\",\"variation\":\"first\",\"value\":10,\"unit\":\"seconds\",\"reason\":\"Mute first 10 seconds\"}]}"
            }
        ]
    },

    # ── Example 5: Correction from cut to mute ──────────────────────────────
    {
        "input": "[VIDEO METADATA]\nName: vlog.mp4\nDuration: 180.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- 0.0 -> 30.0\n\nBackground Music:\n- None\n\n[USER REQUEST]\nno, mute the beginning instead of cutting it",
        "output": "{\"message\":\"Replaced the cut with a mute for the first 30 seconds.\",\"operations\":[{\"operation\":\"mute\",\"variation\":\"first\",\"value\":30,\"unit\":\"seconds\",\"reason\":\"Mute beginning instead of cut\"}]}",
        "history": [
            {
                "role": "user",
                "content": "[VIDEO METADATA]\nName: vlog.mp4\nDuration: 180.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\ncut the first 30 seconds"
            },
            {
                "role": "assistant",
                "content": "{\"message\":\"Removed the first 30 seconds.\",\"operations\":[{\"operation\":\"cut\",\"variation\":\"first\",\"value\":30,\"unit\":\"seconds\",\"reason\":\"Cut first 30 seconds\"}]}"
            }
        ]
    },

    # ── Example 6: Music overlay cancellation ───────────────────────────────
    {
        "input": "[VIDEO METADATA]\nName: travel.mp4\nDuration: 120.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nnevermind, remove the music",
        "output": "{\"message\":\"Removed the background music overlay.\",\"operations\":[]}",
        "history": [
            {
                "role": "user",
                "content": "[VIDEO METADATA]\nName: travel.mp4\nDuration: 120.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nadd upbeat.mp3 to the video"
            },
            {
                "role": "assistant",
                "content": "{\"message\":\"Added upbeat.mp3 to the entire timeline.\",\"operations\":[{\"operation\":\"add_audio_overlay\",\"variation\":\"range\",\"start\":\"0\",\"end\":\"120\",\"unit\":\"seconds\",\"track\":\"upbeat.mp3\",\"reason\":\"Add background music\"}]}"
            }
        ]
    }
]
