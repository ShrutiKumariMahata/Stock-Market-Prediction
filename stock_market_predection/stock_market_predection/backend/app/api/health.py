from fastapi import APIRouter
import torch
import psutil
import platform
from datetime import datetime
import os

router = APIRouter()

@router.get("/health")
def health_check():
    """
    Comprehensive health check endpoint for monitoring and debugging
    """
    try:
        # System information
        system_info = {
            "status": "healthy",
            "timestamp": datetime.now().isoformat(),
            "api_version": "2.1.0",
            "framework": "PyTorch + FastAPI"
        }
        
        # PyTorch/GPU information
        if torch.cuda.is_available():
            gpu_info = {
                "cuda_available": True,
                "device": "cuda",
                "gpu_count": torch.cuda.device_count(),
                "gpu_name": torch.cuda.get_device_name(0) if torch.cuda.device_count() > 0 else "N/A",
                "cuda_version": torch.version.cuda,
                "gpu_memory": {
                    "allocated": f"{torch.cuda.memory_allocated(0) / 1024**2:.2f} MB",
                    "cached": f"{torch.cuda.memory_reserved(0) / 1024**2:.2f} MB"
                }
            }
        else:
            gpu_info = {
                "cuda_available": False,
                "device": "cpu",
                "cpu_cores": psutil.cpu_count(),
                "cpu_percent": psutil.cpu_percent(interval=0.1)
            }
        
        # Memory information
        memory = psutil.virtual_memory()
        memory_info = {
            "total": f"{memory.total / 1024**3:.2f} GB",
            "available": f"{memory.available / 1024**3:.2f} GB",
            "percent_used": f"{memory.percent}%"
        }
        
        # Python environment
        env_info = {
            "python_version": platform.python_version(),
            "torch_version": torch.__version__,
            "os": platform.system(),
            "os_version": platform.version()
        }
        
        # Model information (if models exist)
        model_info = check_models_available()
        
        return {
            **system_info,
            "hardware": gpu_info,
            "memory": memory_info,
            "environment": env_info,
            "models": model_info
        }
        
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }

def check_models_available():
    """Check if trained models exist"""
    model_dir = "checkpoints"  # or wherever you store models
    
    models_found = {}
    if os.path.exists(model_dir):
        for file in os.listdir(model_dir):
            if file.endswith(('.pth', '.h5', '.pkl', '.keras')):
                file_path = os.path.join(model_dir, file)
                models_found[file] = f"{os.path.getsize(file_path) / 1024**2:.2f} MB"
    
    return {
        "available": len(models_found) > 0,
        "count": len(models_found),
        "models": models_found,
        "directory": model_dir
    }

# Additional useful endpoints
@router.get("/health/system")
def system_resources():
    """Detailed system resource monitoring"""
    return {
        "cpu": {
            "percent": psutil.cpu_percent(interval=0.5),
            "count": psutil.cpu_count(),
            "freq": psutil.cpu_freq().current if psutil.cpu_freq() else None
        },
        "memory": {
            "total": psutil.virtual_memory().total,
            "available": psutil.virtual_memory().available,
            "percent": psutil.virtual_memory().percent
        },
        "disk": {
            "total": psutil.disk_usage('/').total,
            "free": psutil.disk_usage('/').free,
            "percent": psutil.disk_usage('/').percent
        }
    }