import instructor
from openai import AsyncOpenAI
from typing import Iterable, List, Optional
from enum import Enum
from pydantic import BaseModel, Field
from fastapi import FastAPI, Request, Form, HTTPException
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, JSONResponse
import os
import json
import logging
import traceback
from dotenv import load_dotenv

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
)
logger = logging.getLogger(__name__)

# Load environment variables from .env file
load_dotenv()

# Create FastAPI app
app = FastAPI(title="Action Item Extractor")

# Mount static files and templates
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")
class PriorityEnum(str, Enum):
    high = "High"
    medium = "Medium"
    low = "Low"


class Subtask(BaseModel):
    """Correctly resolved subtask from the given transcript"""
    id: int
    name: str


class Goal(BaseModel):
    """Correctly resolved goal from the given transcript"""
    id: int
    name: str
    description: str
    priority: PriorityEnum
    assignees: List[str]
    subtasks: Optional[List[Subtask]] = []
    dependencies: Optional[List[int]] = []
    meeting_id: Optional[int] = None  # Reference to the meeting this goal belongs to


class Meeting(BaseModel):
    """Structured information about the meeting from the transcript"""
    id: int = Field(description="Unique identifier for the meeting")
    title: str = Field(description="Meeting title or purpose")
    date: Optional[str] = Field(None, description="Meeting date if mentioned")
    summary: str = Field(description="Brief summary of the meeting")

# Service functions
async def generate_goals(transcript: str, meeting_id: int) -> List[Goal]:
    """Generate goals from a transcript using OpenAI"""
    # Check for API key
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        logger.error("OpenAI API key not found in environment variables")
        raise HTTPException(status_code=500, detail="OpenAI API key not found. Please set OPENAI_API_KEY environment variable.")
    
    logger.info("Creating AsyncOpenAI client with API key")
    # Create AsyncOpenAI client with instructor
    try:
        client = instructor.from_openai(AsyncOpenAI(api_key=api_key))
        logger.debug("AsyncOpenAI client created successfully")
    except Exception as e:
        logger.error(f"Error creating AsyncOpenAI client: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error creating AsyncOpenAI client: {str(e)}")
    
     try:
        logger.info("Making async API call to generate goals")
        response = await client.chat.completions.create(
            model="gpt-4o",
            response_model=Iterable[Goal],
            messages=[
                {
                    "role": "system",
                    "content": "The following is a transcript of a meeting. Extract the action items, goals, subtasks, assignees, and dependencies.",
                },
                {
                    "role": "user",
                    "content": f"Create the action items and goals for the following transcript: {transcript}",
                },
            ],
        )
        # Properly handle the async generator
        goals = []
        async for goal in response:
            # Set the meeting_id for each goal
            goal.meeting_id = meeting_id
            goals.append(goal)
        
        logger.info(f"Successfully generated {len(goals)} goals")
        return goals
        
        logger.info(f"Successfully generated {len(goals)} goals")
        return goals
    except Exception as e:
        logger.error(f"Error generating goals: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error generating goals: {str(e)}")

async def extract_meeting_info(transcript: str) -> Meeting:
    """Extract structured meeting information from transcripts."""
    # Check for API key
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        logger.error("OpenAI API key not found in environment variables")
        raise HTTPException(status_code=500, detail="OpenAI API key not found. Please set OPENAI_API_KEY environment variable.")
    
    try:
        client = instructor.from_openai(AsyncOpenAI(api_key=api_key))
        
        response = await client.chat.completions.create(
            model="gpt-4o",
            response_model=Meeting,
            messages=[
                {
                    "role": "system",
                    "content": "Extract detailed meeting information from this file."
                },
                {
                    "role": "user",
                    "content": f"Extract the complete meeting details from this file: {transcript}"
                }
            ]
        )
        
        logger.info(f"Successfully extracted meeting information: {response}")
        return response
    except Exception as e:
        logger.error(f"Error extracting meeting information: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error extracting meeting information: {str(e)}")
# Routes
@app.get("/", response_class=HTMLResponse)
async def read_root(request: Request):
    """Render the main page"""
    logger.info("Rendering index page")
    return templates.TemplateResponse("index.html", {"request": request})

# Update the /process endpoint
@app.post("/process")
async def process_transcript(transcript: str = Form(...)):
    """Process a transcript and return goals and meeting information"""
    logger.info("Received request to process transcript")
    logger.debug(f"Transcript length: {len(transcript)} characters")
    
    try:
        # Generate goals from transcript
        logger.info("Generating goals from transcript")
        goals = await generate_goals(transcript)
        
        # Extract meeting information
        logger.info("Extracting meeting information from transcript")
        meeting_info = await extract_meeting_info(transcript)
        goals_dict = []
        for goal in goals:
            try:
                goal_dict = goal.dict()
                goals_dict.append(goal_dict)
            except Exception as e:
                logger.error(f"Error converting goal to dict: {str(e)}")
                logger.error(f"Problematic goal: {goal}")
                logger.error(traceback.format_exc())
                raise HTTPException(status_code=500, detail=f"Error processing goal data: {str(e)}")
        
        meeting_dict = meeting_info.dict()
        
        logger.info(f"Successfully processed {len(goals_dict)} goals and meeting information")
        logger.debug(f"Goals data: {json.dumps(goals_dict)}")
        logger.debug(f"Meeting info: {json.dumps(meeting_dict)}")
        
        return JSONResponse(content={"goals": goals_dict, "meeting": meeting_dict})
    except HTTPException as e:
        logger.error(f"HTTP exception occurred: {e.detail}")
        raise e
    except Exception as e:
        logger.error(f"Unexpected error processing transcript: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error processing transcript: {str(e)}")

# For development server with better error reporting
if __name__ == "__main__":
    import uvicorn
    
    # Log startup information
    logger.info("Starting Action Item Extractor application")
    logger.info(f"OpenAI API key set: {bool(os.getenv('OPENAI_API_KEY'))}")
    
    # Print directory structure for debugging
    logger.info("Directory structure:")
    for root, dirs, files in os.walk('.', topdown=True):
        for name in files:
            logger.info(os.path.join(root, name))
    
    # Start the server
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
