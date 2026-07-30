import json
import os

def generate_undo_training_data(output_file="undo_training_data.jsonl"):
    """
    Generates specific training data to teach the SmolLM2 model how to use
    the 'undo' JSON action command with the 'count' parameter.
    """
    examples = [
        {
            "text": "<|im_start|>user\nWait, I made a mistake. Undo my last edit.<|im_end|>\n<|im_start|>assistant\nNo problem, I've removed your last edit.\n<|im_start|>tool_call\n{\"actions\": [{\"type\": \"undo\", \"count\": 1}]}\n<|im_end|>"
        },
        {
            "text": "<|im_start|>user\nCan you undo the last 2 cuts I just asked for?<|im_end|>\n<|im_start|>assistant\nSure thing, I'm rolling back your last 2 cuts.\n<|im_start|>tool_call\n{\"actions\": [{\"type\": \"undo\", \"count\": 2}]}\n<|im_end|>"
        },
        {
            "text": "<|im_start|>user\nPlease revert the previous edit.<|im_end|>\n<|im_start|>assistant\nGot it, reverting your most recent edit now.\n<|im_start|>tool_call\n{\"actions\": [{\"type\": \"undo\", \"count\": 1}]}\n<|im_end|>"
        },
        {
            "text": "<|im_start|>user\nUndo those last two things.<|im_end|>\n<|im_start|>assistant\nUndoing the last 2 actions for you.\n<|im_start|>tool_call\n{\"actions\": [{\"type\": \"undo\", \"count\": 2}]}\n<|im_end|>"
        },
        {
            "text": "<|im_start|>user\nI changed my mind, undo the edit.<|im_end|>\n<|im_start|>assistant\nNo worries, edit undone.\n<|im_start|>tool_call\n{\"actions\": [{\"type\": \"undo\", \"count\": 1}]}\n<|im_end|>"
        }
    ]

    with open(output_file, 'w', encoding='utf-8') as f:
        for ex in examples:
            json.dump(ex, f)
            f.write('\n')
            
    print(f"✅ Generated {len(examples)} undo training examples in {output_file}")
    print("You can now combine this with your main training_data.jsonl file before running train.py")

if __name__ == "__main__":
    generate_undo_training_data()
