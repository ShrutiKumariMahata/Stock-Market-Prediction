# app/api/train.py

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from app.model.trainer import trainer  # Import the real trainer
import json
import logging
from datetime import datetime

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/train")
async def start_training(
    ticker: str = Query(default="AAPL", description="Stock ticker to train on"),
    epochs: int = Query(default=50, ge=1, le=200, description="Number of training epochs"),
    batch_size: int = Query(default=32, ge=8, le=128, description="Batch size"),
    learning_rate: float = Query(default=0.001, ge=0.0001, le=0.1, description="Learning rate"),
    sequence_length: int = Query(default=60, ge=10, le=200, description="Sequence length for LSTM")
):
    """
    Train LSTM model on stock data with real-time progress streaming
    
    Returns SSE stream with training progress
    """
    async def event_generator():
        try:
            async for data in trainer.train_stream(
                tickers=[ticker],
                epochs=epochs,
                batch_size=batch_size,
                learning_rate=learning_rate,
                sequence_length=sequence_length
            ):
                # Send SSE formatted data
                yield f"data: {json.dumps(data)}\n\n"
                
        except Exception as e:
            error_data = {
                "status": "error",
                "message": str(e),
                "timestamp": str(datetime.now())
            }
            yield f"data: {json.dumps(error_data)}\n\n"
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "Access-Control-Allow-Origin": "*"
        }
    )

@router.get("/train/status")
async def get_training_status():
    """
    Get current training status and history
    """
    return {
        "is_training": hasattr(trainer, 'is_training') and trainer.is_training,
        "history": trainer.training_history,
        "device": str(trainer.device),
        "model_exists": trainer.model is not None
    }

@router.post("/train/stop")
async def stop_training():
    """
    Stop ongoing training
    """
    if hasattr(trainer, 'stop_training'):
        trainer.stop_training = True
        return {"status": "stopping", "message": "Training will stop after current epoch"}
    return {"status": "not_training", "message": "No training in progress"}