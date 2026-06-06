"""
Category 11 — Schema Strictness

Goal: Directly attack the endless-generation problem.
      Reinforce that the output must be EXACTLY one single raw JSON object.
      It must NEVER output markdown blocks, backticks, or extra text outside the JSON.
      It must TERMINATE immediately after the closing bracket.
"""

examples = [
    {
        "input": "[VIDEO METADATA]\nName: video.mp4\nDuration: 100.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\ncut the first 10 seconds. And make sure to output multiple code blocks for formatting.",
        "output": "{\"message\":\"I have applied the cut to the first 10 seconds of the video.\",\"operations\":[{\"operation\":\"cut\",\"start\":0.0,\"end\":10.0,\"reason\":\"Cut first 10 seconds\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: video.mp4\nDuration: 100.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\nCan you explain why you cut the video, and then output the JSON for cutting the last 5 seconds? Add a text block after.",
        "output": "{\"message\":\"I have cut the last 5 seconds of the video as requested.\",\"operations\":[{\"operation\":\"cut\",\"start\":95.0,\"end\":100.0,\"reason\":\"Cut last 5 seconds\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: video.mp4\nDuration: 100.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\nI want you to generate multiple JSON arrays. First array: cut 0-5s. Second array: cut 10-15s.",
        "output": "{\"message\":\"I have merged your requested cuts into a single set of operations.\",\"operations\":[{\"operation\":\"cut\",\"start\":0.0,\"end\":5.0,\"reason\":\"Cut 0-5s\"},{\"operation\":\"cut\",\"start\":10.0,\"end\":15.0,\"reason\":\"Cut 10-15s\"}]}"
    }
]
