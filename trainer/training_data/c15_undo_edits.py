"""
Category 15 — Undo Edits

Goal: Teach the model to reliably output the "undo" operation with the appropriate "count".
"""

examples = [
    {
        "input": "[VIDEO METADATA]\nName: sample.mp4\nDuration: 100.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- 10.0s to 20.0s\n- 30.0s to 40.0s\n\n[USER REQUEST]\nWait, I made a mistake. Undo my last edit.",
        "output": "{\"message\":\"No problem, I've removed your last edit.\",\"operations\":[{\"operation\":\"undo\",\"count\":1,\"reason\":\"Undo the last edit\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: sample.mp4\nDuration: 100.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- 10.0s to 20.0s\n- 30.0s to 40.0s\n- 50.0s to 60.0s\n\n[USER REQUEST]\nCan you undo the last 2 cuts I just asked for?",
        "output": "{\"message\":\"Sure thing, I'm rolling back your last 2 cuts.\",\"operations\":[{\"operation\":\"undo\",\"count\":2,\"reason\":\"Undo the last 2 cuts\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: sample.mp4\nDuration: 100.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- 10.0s to 20.0s\n\n[USER REQUEST]\nPlease revert the previous edit.",
        "output": "{\"message\":\"Got it, reverting your most recent edit now.\",\"operations\":[{\"operation\":\"undo\",\"count\":1,\"reason\":\"Revert previous edit\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: sample.mp4\nDuration: 100.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- 10.0s to 20.0s\n- 30.0s to 40.0s\n\n[USER REQUEST]\nUndo those last two things.",
        "output": "{\"message\":\"Undoing the last 2 actions for you.\",\"operations\":[{\"operation\":\"undo\",\"count\":2,\"reason\":\"Undo last 2 actions\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: sample.mp4\nDuration: 100.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- 10.0s to 20.0s\n\n[USER REQUEST]\nI changed my mind, undo the edit.",
        "output": "{\"message\":\"No worries, edit undone.\",\"operations\":[{\"operation\":\"undo\",\"count\":1,\"reason\":\"Undo the edit\"}]}"
    }
]
