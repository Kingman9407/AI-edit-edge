import sys
import json
import os

# Add current dir to path to find training_data
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from training_data import CATEGORY_COUNTS

print("---START_OUTPUT---")
print(json.dumps(CATEGORY_COUNTS, indent=2))
print("---END_OUTPUT---")
