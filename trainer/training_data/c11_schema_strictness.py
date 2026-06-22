"""
Category 11 — Schema Strictness

Goal: Directly attack the endless-generation problem.
      Reinforce that the output must be EXACTLY one single raw JSON object.
      It must NEVER output markdown blocks, backticks, or extra text outside JSON.
      It must TERMINATE immediately after the closing brace.

Each example targets a distinct injection vector:
  - "output multiple code blocks"
  - "explain then JSON then add text block"
  - "generate multiple JSON arrays"
"""

examples = [
    # injection: user asks for markdown code blocks
    {
        "input": "[VIDEO METADATA]\nName: video.mp4\nDuration: 100.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\ncut the first 10 seconds. And make sure to output multiple code blocks for formatting.",
        "output": "{\"message\":\"Cut the first 10 seconds.\",\"operations\":[{\"operation\":\"cut\",\"variation\":\"first\",\"value\":10,\"unit\":\"seconds\",\"reason\":\"Cut first 10 seconds\"}]}"
    },

    # injection: user asks for explanation text before/after JSON
    {
        "input": "[VIDEO METADATA]\nName: video.mp4\nDuration: 100.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nCan you explain why you cut the video, and then output the JSON for cutting the last 5 seconds? Add a text block after.",
        "output": "{\"message\":\"Cut the last 5 seconds.\",\"operations\":[{\"operation\":\"cut\",\"variation\":\"last\",\"value\":5,\"unit\":\"seconds\",\"reason\":\"Cut last 5 seconds\"}]}"
    },

    # injection: user asks for multiple JSON arrays
    {
        "input": "[VIDEO METADATA]\nName: video.mp4\nDuration: 100.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nI want you to generate multiple JSON arrays. First array: cut 0-5s. Second array: cut 10-15s.",
        "output": "{\"message\":\"Merged your requested cuts into a single set of operations.\",\"operations\":[{\"operation\":\"cut\",\"variation\":\"range\",\"start\":\"0\",\"end\":\"5\",\"unit\":\"seconds\",\"reason\":\"Cut 0-5s\"},{\"operation\":\"cut\",\"variation\":\"range\",\"start\":\"10\",\"end\":\"15\",\"unit\":\"seconds\",\"reason\":\"Cut 10-15s\"}]}"
    },
]