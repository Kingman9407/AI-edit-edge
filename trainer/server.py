import os
import sys
import time
import uuid
import json
import torch
import datetime
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from transformers import AutoModelForCausalLM, AutoTokenizer, pipeline

# Import our deterministic timeline intent resolver
from resolver import resolve_intents

# Config Paths
MODEL_PATH = "./fine_tuned_smollm"
LOG_DIR = "./logs"
LOG_FILE_PATH = os.path.join(LOG_DIR, "api_logs.jsonl")

# Ensure logs folder exists
os.makedirs(LOG_DIR, exist_ok=True)

# System Instruction (matching fine-tuning SFT phase)
SYSTEM_INSTRUCTION = (
    "You are an intelligent video editor AI agent. Your sole task is to analyze the user's video editing "
    "request and return a raw JSON list of structured intents representing their instruction. "
    "Do not write any conversation, conversational greeting, or explanations. "
    "Output ONLY the raw valid JSON list."
)

app = FastAPI(
    title="SmolLM2 Video Editor Model API",
    description="Backend API hosting the local fine-tuned SmolLM2 video editing model for Next.js integration.",
    version="1.0.0"
)

# Enable CORS for Next.js frontend (typically port 3000, 3001, etc.)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust this in production to allow only specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global model references
model_pipeline = None
tokenizer = None
device_name = "cpu"
model_status = "unloaded"
model_load_error = None

def init_model():
    """Initializes and loads the model pipeline on the best available hardware accelerator."""
    global model_pipeline, tokenizer, device_name, model_status, model_load_error
    
    # 1. Determine local accelerator
    if torch.backends.mps.is_available():
        device_name = "mps"
    elif torch.cuda.is_available():
        device_name = "cuda"
    else:
        device_name = "cpu"
        
    print(f"📡 API Server: Starting model initialization on accelerator '{device_name.upper()}'...")
    
    # 2. Check if the model directory has valid weights
    has_weights = os.path.exists(MODEL_PATH) and (
        any(f.endswith(".safetensors") for f in os.listdir(MODEL_PATH)) or 
        any(f.endswith(".bin") for f in os.listdir(MODEL_PATH))
    )
    
    if not has_weights:
        model_status = "missing_weights"
        model_load_error = (
            f"No fine-tuned model weights found in directory '{MODEL_PATH}'. "
            "Please run the fine-tuning script first (Option 1 in main.py)."
        )
        print(f"⚠️ WARNING: {model_load_error}")
        print("💡 The server will start in MOCK mode. Run training to enable the actual AI model.")
        return

    try:
        # Load custom weights locally
        tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH, local_files_only=True)
        model = AutoModelForCausalLM.from_pretrained(
            MODEL_PATH, 
            torch_dtype=torch.float32, 
            local_files_only=True
        ).to(device_name)
        
        model_pipeline = pipeline(
            "text-generation", 
            model=model, 
            tokenizer=tokenizer,
            device=device_name
        )
        
        model_status = "loaded"
        model_load_error = None
        print(f"🚀 SUCCESS: Fine-tuned video editor model loaded successfully on '{device_name.upper()}'!")
    except Exception as e:
        model_status = "failed_to_load"
        model_load_error = str(e)
        print(f"❌ ERROR: Failed to load model weights: {e}", file=sys.stderr)

@app.on_event("startup")
def startup_event():
    # Load model on startup
    init_model()

# --- Pydantic Request/Response Schemas ---

class SilentSection(BaseModel):
    start: float
    end: float

class ExistingCut(BaseModel):
    start: float
    end: float

class BackgroundMusic(BaseModel):
    track: str
    start: float
    end: float

class WorkspaceState(BaseModel):
    duration: float = Field(..., description="Duration of the video timeline in seconds")
    playhead: float = Field(0.0, description="Current playhead position in seconds")
    silent_sections: List[SilentSection] = Field(default_factory=list, description="Identified silent segments")
    existing_cuts: List[ExistingCut] = Field(default_factory=list, description="Cuts already made in the timeline")
    background_music: List[BackgroundMusic] = Field(default_factory=list, description="Background audio overlay list")

class VideoMetadata(BaseModel):
    name: str = "untitled_video.mp4"
    type: str = "video/mp4"
    resolution: str = "1920x1080"

class EditRequest(BaseModel):
    user_message: str = Field(..., description="Natural language video editing command")
    workspace_state: WorkspaceState = Field(..., description="Current timeline and playback state")
    video_metadata: Optional[VideoMetadata] = Field(default_factory=VideoMetadata, description="Basic video specs")

class MetricDetails(BaseModel):
    latency_seconds: float
    tokens_generated: Optional[int] = None
    tokens_per_second: Optional[float] = None
    hardware_accelerator: str
    model_mode: str  # "actual" or "mock"

class EditResponse(BaseModel):
    status: str
    raw_model_output: str
    parsed_intents: List[Dict[str, Any]]
    resolved_operations: List[Dict[str, Any]]
    metrics: MetricDetails
    warning: Optional[str] = None

# --- Helper Functions ---

def clean_chatml_response(text: str) -> str:
    """Extracts the clean response text from ChatML format tags."""
    if "<|im_start|>assistant" in text:
        text = text.split("<|im_start|>assistant")[-1]
    return text.replace("<|im_end|>", "").strip()

def construct_video_context(metadata: VideoMetadata, state: WorkspaceState) -> str:
    """Reconstructs the standard video context prompt matching SFT SFT dataset schema."""
    # Convert lists of models to native list of dicts
    existing_cuts = [cut.dict() for cut in state.existing_cuts]
    silent_sections = [sec.dict() for sec in state.silent_sections]
    bg_music = [music.dict() for music in state.background_music]
    
    return (
        f"[VIDEO METADATA]\n"
        f"Name: {metadata.name}\n"
        f"Type: {metadata.type}\n"
        f"Duration: {state.duration}s\n"
        f"Resolution: {metadata.resolution}\n"
        f"Playhead: {state.playhead}s\n\n"
        f"[TIMELINE STATE]\n"
        f"Existing Cuts: {json.dumps(existing_cuts)}\n"
        f"Silent Sections: {json.dumps(silent_sections)}\n"
        f"Background Music: {json.dumps(bg_music)}"
    )

def log_api_transaction(
    request_data: Dict[str, Any], 
    response_data: Optional[Dict[str, Any]], 
    latency: float, 
    success: bool, 
    error_msg: Optional[str] = None
):
    """Saves API request-response transaction log safely into the JSON Lines file."""
    try:
        log_entry = {
            "timestamp": datetime.datetime.utcnow().isoformat() + "Z",
            "request_id": str(uuid.uuid4()),
            "success": success,
            "latency_seconds": round(latency, 4),
            "request": request_data,
            "response": response_data,
            "error": error_msg
        }
        with open(LOG_FILE_PATH, "a", encoding="utf-8") as f:
            f.write(json.dumps(log_entry, ensure_ascii=False) + "\n")
    except Exception as e:
        print(f"⚠️ Logger Warning: Failed to save API transaction log: {e}", file=sys.stderr)

def generate_mock_response(user_message: str, state: WorkspaceState) -> tuple[str, List[Dict[str, Any]]]:
    """Generates standard, smart mock response if the model is not yet trained/available."""
    msg = user_message.lower()
    
    # 1. Simple heuristic rule base to give excellent mock responses to the frontend
    if "silent" in msg or "silence" in msg or "gap" in msg:
        intents = [{"intent": "remove_silent_sections"}]
        raw = json.dumps(intents)
    elif "cut" in msg or "remove" in msg:
        # Check if they specify a range
        if "from" in msg or "to" in msg:
            intents = [{"intent": "cut_range", "start": "0:30", "end": "1:00"}]
        elif "beginning" in msg or "start" in msg or "intro" in msg:
            intents = [{"intent": "remove_segment", "position": "beginning", "duration_seconds": 10.0}]
        elif "end" in msg or "outro" in msg or "last" in msg:
            intents = [{"intent": "remove_segment", "position": "last", "duration_seconds": 15.0}]
        else:
            intents = [{"intent": "remove_from_playhead_to_end"}]
        raw = json.dumps(intents)
    elif "mute" in msg or "quiet" in msg:
        intents = [{"intent": "mute_segment", "start": 15.0, "end": 45.0}]
        raw = json.dumps(intents)
    elif "music" in msg or "audio" in msg or "song" in msg:
        intents = [{"intent": "add_music", "track": "background_music.mp3", "start": 0.0, "end": "duration"}]
        raw = json.dumps(intents)
    else:
        # Default mock intent
        intents = [{"intent": "remove_silent_sections"}]
        raw = json.dumps(intents)
        
    return raw, intents

# --- API Routes ---

@app.get("/health")
def health_check():
    """Returns the API health status and configuration details."""
    has_weights = os.path.exists(MODEL_PATH)
    return {
        "status": "healthy",
        "hardware_accelerator": device_name,
        "model_status": model_status,
        "model_path": MODEL_PATH,
        "model_weights_exist": has_weights,
        "load_error": model_load_error,
        "server_time": datetime.datetime.utcnow().isoformat() + "Z"
    }

@app.post("/api/edit", response_model=EditResponse)
def edit_timeline(request: EditRequest, background_tasks: BackgroundTasks):
    """
    Processes a natural language editing command.
    Generates video editing intents using SmolLM2 and translates them into actionable timeline operations.
    """
    start_time = time.perf_counter()
    request_dict = request.dict()
    
    # 1. Format the SFT prompt template matching training
    video_context = construct_video_context(request.video_metadata, request.workspace_state)
    full_user_content = f"{video_context}\n\n[USER MESSAGE]\n{request.user_message}"
    
    messages = [
        {"role": "system", "content": SYSTEM_INSTRUCTION},
        {"role": "user", "content": full_user_content}
    ]
    
    raw_output = ""
    parsed_intents = []
    resolved_ops = []
    tokens_generated = None
    tokens_per_sec = None
    model_mode = "actual"
    warning_msg = None
    
    # 2. Check if model is loaded
    if model_status != "loaded" or model_pipeline is None:
        model_mode = "mock"
        warning_msg = (
            f"Model not loaded (Status: {model_status}). Running in mock mode. "
            "To resolve, run fine-tuning first to train the agent weights."
        )
        # Generate a smart fallback mock response
        raw_output, parsed_intents = generate_mock_response(request.user_message, request.workspace_state)
        
    else:
        # Run inference using the loaded Hugging Face Pipeline
        try:
            prompt = model_pipeline.tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
            
            # Predict
            outputs = model_pipeline(
                prompt, 
                max_new_tokens=256, 
                do_sample=True, 
                temperature=0.7,
                clean_up_tokenization_spaces=False,
                eos_token_id=tokenizer.eos_token_id,
                pad_token_id=tokenizer.eos_token_id
            )
            
            raw_text = outputs[0]["generated_text"]
            raw_output = clean_chatml_response(raw_text)
            
            # Parse metrics
            prompt_token_count = len(model_pipeline.tokenizer.encode(prompt))
            total_token_count = len(model_pipeline.tokenizer.encode(raw_text))
            tokens_generated = max(1, total_token_count - prompt_token_count)
            
            # Parse JSON
            parsed_intents = json.loads(raw_output)
            if not isinstance(parsed_intents, list):
                if isinstance(parsed_intents, dict):
                    parsed_intents = [parsed_intents]
                else:
                    raise ValueError("Model output parsed as JSON but is not a list/dict of intents")
            
        except Exception as e:
            # Handle model runtime error or JSON parsing error gracefully
            model_mode = "mock_fallback"
            warning_msg = f"Inference or JSON parsing failed: {e}. Fallback to mock mode."
            raw_output, parsed_intents = generate_mock_response(request.user_message, request.workspace_state)

    # 3. Resolve parsed intents into execution operations
    try:
        # Convert Pydantic state to dict for resolver compat
        state_dict = {
            "duration": request.workspace_state.duration,
            "playhead": request.workspace_state.playhead,
            "silent_sections": [s.dict() for s in request.workspace_state.silent_sections],
            "existing_cuts": [c.dict() for c in request.workspace_state.existing_cuts],
        }
        resolved_ops = resolve_intents(parsed_intents, state_dict)
    except Exception as e:
        resolved_ops = []
        warning_msg = f"Failed resolving parsed intents: {e}." if not warning_msg else f"{warning_msg} Also failed resolving: {e}."

    # 4. Latency calculations
    latency = time.perf_counter() - start_time
    if tokens_generated:
        tokens_per_sec = tokens_generated / latency
        
    metrics = MetricDetails(
        latency_seconds=round(latency, 4),
        tokens_generated=tokens_generated,
        tokens_per_second=tokens_per_sec,
        hardware_accelerator=device_name,
        model_mode=model_mode
    )
    
    response_payload = EditResponse(
        status="success",
        raw_model_output=raw_output,
        parsed_intents=parsed_intents,
        resolved_operations=resolved_ops,
        metrics=metrics,
        warning=warning_msg
    )
    
    # 5. Persistent Input/Output Logging (performed in background to minimize latency response time)
    background_tasks.add_task(
        log_api_transaction, 
        request_data=request_dict, 
        response_data=response_payload.dict(), 
        latency=latency, 
        success=True
    )
    
    return response_payload

@app.get("/api/logs")
def get_api_logs(limit: int = 50):
    """
    Retrieves history logs of API transactions, useful for rendering a log dashboard or developer trace panel.
    """
    if not os.path.exists(LOG_FILE_PATH):
        return []
        
    logs = []
    try:
        with open(LOG_FILE_PATH, "r", encoding="utf-8") as f:
            # Read lines and load JSON
            lines = f.readlines()
            # Retrieve latest logs first
            for line in reversed(lines):
                if line.strip():
                    logs.append(json.loads(line.strip()))
                if len(logs) >= limit:
                    break
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read log transactions: {e}")
        
    return logs

if __name__ == "__main__":
    import uvicorn
    # Standard server launch on 0.0.0.0:8000
    print("🎬 Launching Local Video Editor LLM FastAPI Host...")
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
