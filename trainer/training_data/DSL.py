"""
Hornet DSL — Command Reference (with variations)

Interpretation spec, not training data. One short output example per
variation, with a one-line description of what it does.

Output format: COMMAND MODE ARGS — all positional, all uppercase, no
key=value pairs. Time values are passed through exactly as the user
typed them (echoed, not normalized) — the backend resolves them.
"""

DSL_REFERENCE = {

    "CUT": {
        "description": "Removes a section of the video.",
        "variations": {
            "first": {
                "description": "Removes a duration from the start.",
                "example": "CUT FIRST 10 SEC",
            },
            "last": {
                "description": "Removes a duration from the end.",
                "example": "CUT LAST 1 MIN",
            },
            "range": {
                "description": "Removes everything between two timestamps.",
                "example": "CUT RANGE 1:30 2:00",
            },
            "before_playhead": {
                "description": (
                    "Removes video relative to the playhead. With no argument, "
                    "removes everything before it. With a duration argument, "
                    "removes only that bounded window immediately before it."
                ),
                "example": "CUT BEFORE_PLAYHEAD",
                "example_bounded": "CUT BEFORE_PLAYHEAD 10 SEC",
            },
            "after_playhead": {
                "description": (
                    "Removes video relative to the playhead. With no argument, "
                    "removes everything after it. With a duration argument, "
                    "removes only that bounded window immediately after it."
                ),
                "example": "CUT AFTER_PLAYHEAD",
                "example_bounded": "CUT AFTER_PLAYHEAD 45 SEC",
            },
        },
    },

    "MUTE": {
        "description": "Silences audio over a section of the video.",
        "variations": {
            "first": {
                "description": "Mutes a duration from the start.",
                "example": "MUTE FIRST 5 SEC",
            },
            "last": {
                "description": "Mutes a duration from the end.",
                "example": "MUTE LAST 20 SEC",
            },
            "range": {
                "description": "Mutes everything between two timestamps.",
                "example": "MUTE RANGE 0:45 1:10",
            },
            "before_playhead": {
                "description": (
                    "Mutes audio relative to the playhead. With no argument, "
                    "mutes everything before it. With a duration argument, "
                    "mutes only that bounded window immediately before it."
                ),
                "example": "MUTE BEFORE_PLAYHEAD",
                "example_bounded": "MUTE BEFORE_PLAYHEAD 10 SEC",
            },
            "after_playhead": {
                "description": (
                    "Mutes audio relative to the playhead. With no argument, "
                    "mutes everything after it. With a duration argument, "
                    "mutes only that bounded window immediately after it."
                ),
                "example": "MUTE AFTER_PLAYHEAD",
                "example_bounded": "MUTE AFTER_PLAYHEAD 30 SEC",
            },
        },
    },

    "ADD_AUDIO_OVERLAY": {
        "description": "Layers a background/audio track over the video.",
        "variations": {
            "first": {
                "description": "Overlays audio over a duration from the start.",
                "example": "ADD_AUDIO_OVERLAY FIRST 15 SEC track.mp3",
            },
            "last": {
                "description": "Overlays audio over a duration from the end.",
                "example": "ADD_AUDIO_OVERLAY LAST 30 SEC track.mp3",
            },
            "range": {
                "description": "Overlays audio between two timestamps.",
                "example": "ADD_AUDIO_OVERLAY RANGE 2:00 2:45 track.mp3",
            },
            "full_video": {
                "description": "Overlays audio across the entire video.",
                "example": "ADD_AUDIO_OVERLAY FULL_VIDEO track.mp3",
            },
        },
    },

    "MERGE": {
        "description": "Joins a clip from the media bin onto the timeline. Alias: CONCAT.",
        "variations": {
            "start": {
                "description": "Prepends a clip to the beginning of the timeline.",
                "example": "MERGE START intro.mp4",
            },
            "end": {
                "description": "Appends a clip to the end of the timeline.",
                "example": "MERGE END outro.mp4",
            },
            "after_time": {
                "description": "Inserts a clip immediately after a given timestamp.",
                "example": "MERGE AFTER_TIME 1:20 bonus_scene.mp4",
            },
        },
    },

    "UNDO": {
        "description": "Reverts previous edits on the timeline.",
        "variations": {
            "count": {
                "description": "Rolls back a specific number of steps.",
                "example": "UNDO 2",
            },
            "all": {
                "description": "Rolls back every edit made in the session.",
                "example": "UNDO ALL",
            },
        },
    },
}


if __name__ == "__main__":
    for command, data in DSL_REFERENCE.items():
        print(f"{command} — {data['description']}")
        for variation, v in data["variations"].items():
            print(f"  [{variation}] {v['description']}")
            print(f"    {v['example']}")
            if "example_bounded" in v:
                print(f"    {v['example_bounded']}")
        print()