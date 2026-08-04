import os
import sys

# Set all cache dirs to inside the workspace
cache_dir = os.path.abspath("./.cache")
os.makedirs(cache_dir, exist_ok=True)
os.environ["HF_HOME"] = cache_dir
os.environ["HUGGINGFACE_HUB_CACHE"] = cache_dir
os.environ["TRANSFORMERS_CACHE"] = cache_dir
os.environ["TORCH_HOME"] = cache_dir
os.environ["HF_DATASETS_CACHE"] = cache_dir

from sentence_transformers import SentenceTransformer
SentenceTransformer('BAAI/bge-small-en-v1.5')
print("Model downloaded successfully to:", cache_dir)
