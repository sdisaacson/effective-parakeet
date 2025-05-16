# main.py
from fastapi import FastAPI, Depends, HTTPException, status
from .app import models
from sqlalchemy.orm import Session
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from typing import List, Optional

from .app import schemas

# Database configuration
SQLALCHEMY_DATABASE_URL = "postgresql://user:password@localhost/actionitems"
engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

app = FastAPI(title="Action Item Extractor API")

# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Meeting endpoints
@app.post("/meetings/", response_model=schemas.Meeting, status_code=status.HTTP_201_CREATED)
def create_meeting(meeting: schemas.MeetingCreate, db: Session = Depends(get_db)):
    db_meeting = models.Meeting(**meeting.dict())
    db.add(db_meeting)
    db.commit()
    db.refresh(db_meeting)
    return db_meeting

@app.get("/meetings/", response_model=List[schemas.Meeting])
def read_meetings(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    meetings = db.query(models.Meeting).offset(skip).limit(limit).all()
    return meetings

@app.get("/meetings/{meeting_id}", response_model=schemas.MeetingWithGoals)
def read_meeting(meeting_id: int, db: Session = Depends(get_db)):
    db_meeting = db.query(models.Meeting).filter(models.Meeting.id == meeting_id).first()
    if db_meeting is None:
        raise HTTPException(status_code=404, detail="Meeting not found")
    return db_meeting

@app.put("/meetings/{meeting_id}", response_model=schemas.Meeting)
def update_meeting(meeting_id: int, meeting: schemas.MeetingCreate, db: Session = Depends(get_db)):
    db_meeting = db.query(models.Meeting).filter(models.Meeting.id == meeting_id).first()
    if db_meeting is None:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    for key, value in meeting.dict().items():
        setattr(db_meeting, key, value)
    
    db.add(db_meeting)
    db.commit()
    db.refresh(db_meeting)
    return db_meeting

@app.delete("/meetings/{meeting_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_meeting(meeting_id: int, db: Session = Depends(get_db)):
    db_meeting = db.query(models.Meeting).filter(models.Meeting.id == meeting_id).first()
    if db_meeting is None:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    db.delete(db_meeting)
    db.commit()
    return None

# Goal endpoints
@app.post("/meetings/{meeting_id}/goals/", response_model=schemas.Goal, status_code=status.HTTP_201_CREATED)
def create_goal(meeting_id: int, goal: schemas.GoalCreate, db: Session = Depends(get_db)):
    # Check if meeting exists
    db_meeting = db.query(models.Meeting).filter(models.Meeting.id == meeting_id).first()
    if db_meeting is None:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    # Create goal
    goal_data = goal.dict(exclude={"assignee_ids", "dependency_ids", "subtasks"})
    db_goal = models.Goal(**goal_data, meeting_id=meeting_id)
    db.add(db_goal)
    db.flush()  # Flush to get the goal ID
    
    # Add assignees
    if goal.assignee_ids:
        assignees = db.query(models.Assignee).filter(models.Assignee.id.in_(goal.assignee_ids)).all()
        db_goal.assignees = assignees
    
    # Add dependencies
    if goal.dependency_ids:
        for dep_id in goal.dependency_ids:
            # Check if the dependency exists
            dependency = db.query(models.Goal).filter(models.Goal.id == dep_id).first()
            if not dependency:
                continue
            
            # Create the dependency
            db_dependency = models.Dependency(dependent_goal_id=db_goal.id, dependency_goal_id=dep_id)
            db.add(db_dependency)
    
    # Add subtasks
    if goal.subtasks:
        for subtask in goal.subtasks:
            db_subtask = models.Subtask(**subtask.dict(), goal_id=db_goal.id)
            db.add(db_subtask)
    
    db.commit()
    db.refresh(db_goal)
    return db_goal

@app.get("/meetings/{meeting_id}/goals/", response_model=List[schemas.Goal])
def read_goals(meeting_id: int, db: Session = Depends(get_db)):
    # Check if meeting exists
    db_meeting = db.query(models.Meeting).filter(models.Meeting.id == meeting_id).first()
    if db_meeting is None:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    goals = db.query(models.Goal).filter(models.Goal.meeting_id == meeting_id).all()
    return goals

@app.get("/goals/{goal_id}", response_model=schemas.GoalWithDependencies)
def read_goal(goal_id: int, db: Session = Depends(get_db)):
    db_goal = db.query(models.Goal).filter(models.Goal.id == goal_id).first()
    if db_goal is None:
        raise HTTPException(status_code=404, detail="Goal not found")
    return db_goal

@app.put("/goals/{goal_id}", response_model=schemas.Goal)
def update_goal(goal_id: int, goal: schemas.GoalCreate, db: Session = Depends(get_db)):
    db_goal = db.query(models.Goal).filter(models.Goal.id == goal_id).first()
    if db_goal is None:
        raise HTTPException(status_code=404, detail="Goal not found")
    
    # Update basic fields
    for key, value in goal.dict(exclude={"assignee_ids", "dependency_ids", "subtasks"}).items():
        setattr(db_goal, key, value)
    
    # Update assignees if provided
    if goal.assignee_ids is not None:
        assignees = db.query(models.Assignee).filter(models.Assignee.id.in_(goal.assignee_ids)).all()
        db_goal.assignees = assignees
    
    # Update dependencies if provided
    if goal.dependency_ids is not None:
        # Remove existing dependencies
        db.query(models.Dependency).filter(models.Dependency.dependent_goal_id == goal_id).delete()
        
        # Add new dependencies
        for dep_id in goal.dependency_ids:
            # Check for circular dependencies
            if dep_id == goal_id:
                continue
                
            # Check if dependency exists
            dependency = db.query(models.Goal).filter(models.Goal.id == dep_id).first()
            if not dependency:
                continue
            
            # Create the dependency
            db_dependency = models.Dependency(dependent_goal_id=goal_id, dependency_goal_id=dep_id)
            db.add(db_dependency)
    
    db.add(db_goal)
    db.commit()
    db.refresh(db_goal)
    return db_goal

@app.delete("/goals/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_goal(goal_id: int, db: Session = Depends(get_db)):
    db_goal = db.query(models.Goal).filter(models.Goal.id == goal_id).first()
    if db_goal is None:
        raise HTTPException(status_code=404, detail="Goal not found")
    
    db.delete(db_goal)
    db.commit()
    return None

# Subtask endpoints
@app.post("/goals/{goal_id}/subtasks/", response_model=schemas.Subtask, status_code=status.HTTP_201_CREATED)
def create_subtask(goal_id: int, subtask: schemas.SubtaskCreate, db: Session = Depends(get_db)):
    # Check if goal exists
    db_goal = db.query(models.Goal).filter(models.Goal.id == goal_id).first()
    if db_goal is None:
        raise HTTPException(status_code=404, detail="Goal not found")
    
    db_subtask = models.Subtask(**subtask.dict(), goal_id=goal_id)
    db.add(db_subtask)
    db.commit()
    db.refresh(db_subtask)
    return db_subtask

@app.get("/goals/{goal_id}/subtasks/", response_model=List[schemas.Subtask])
def read_subtasks(goal_id: int, db: Session = Depends(get_db)):
    # Check if goal exists
    db_goal = db.query(models.Goal).filter(models.Goal.id == goal_id).first()
    if db_goal is None:
        raise HTTPException(status_code=404, detail="Goal not found")
    
    subtasks = db.query(models.Subtask).filter(models.Subtask.goal_id == goal_id).all()
    return subtasks

@app.put("/subtasks/{subtask_id}", response_model=schemas.Subtask)
def update_subtask(subtask_id: int, subtask: schemas.SubtaskCreate, db: Session = Depends(get_db)):
    db_subtask = db.query(models.Subtask).filter(models.Subtask.id == subtask_id).first()
    if db_subtask is None:
        raise HTTPException(status_code=404, detail="Subtask not found")
    
    for key, value in subtask.dict().items():
        setattr(db_subtask, key, value)
    
    db.add(db_subtask)
    db.commit()
    db.refresh(db_subtask)
    return db_subtask

@app.delete("/subtasks/{subtask_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_subtask(subtask_id: int, db: Session = Depends(get_db)):
    db_subtask = db.query(models.Subtask).filter(models.Subtask.id == subtask_id).first()
    if db_subtask is None:
        raise HTTPException(status_code=404, detail="Subtask not found")
    
    db.delete(db_subtask)
    db.commit()
    return None

# Assignee endpoints
@app.post("/assignees/", response_model=schemas.Assignee, status_code=status.HTTP_201_CREATED)
def create_assignee(assignee: schemas.AssigneeCreate, db: Session = Depends(get_db)):
    # Check if assignee with this name already exists
    db_assignee = db.query(models.Assignee).filter(models.Assignee.name == assignee.name).first()
    if db_assignee:
        return db_assignee
    
    db_assignee = models.Assignee(**assignee.dict())
    db.add(db_assignee)
    db.commit()
    db.refresh(db_assignee)
    return db_assignee

@app.get("/assignees/", response_model=List[schemas.Assignee])
def read_assignees(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    assignees = db.query(models.Assignee).offset(skip).limit(limit).all()
    return assignees

# Dependency management endpoints
@app.post("/dependencies/", status_code=status.HTTP_201_CREATED)
def create_dependency(dependency: schemas.DependencyCreate, db: Session = Depends(get_db)):
    # Check if both goals exist
    dependent_goal = db.query(models.Goal).filter(models.Goal.id == dependency.dependent_goal_id).first()
    dependency_goal = db.query(models.Goal).filter(models.Goal.id == dependency.dependency_goal_id).first()
    
    if not dependent_goal or not dependency_goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    
    # Check for self-dependency
    if dependency.dependent_goal_id == dependency.dependency_goal_id:
        raise HTTPException(status_code=400, detail="A goal cannot depend on itself")
    
    # Check if the dependency already exists
    existing_dependency = db.query(models.Dependency).filter(
        models.Dependency.dependent_goal_id == dependency.dependent_goal_id,
        models.Dependency.dependency_goal_id == dependency.dependency_goal_id
    ).first()
    
    if existing_dependency:
        return {"message": "Dependency already exists"}
    
    # Create the dependency
    db_dependency = models.Dependency(**dependency.dict())
    db.add(db_dependency)
    db.commit()
    
    return {"message": "Dependency created successfully"}

@app.delete("/dependencies/", status_code=status.HTTP_204_NO_CONTENT)
def delete_dependency(dependency: schemas.DependencyDelete, db: Session = Depends(get_db)):
    # Check if the dependency exists
    db_dependency = db.query(models.Dependency).filter(
        models.Dependency.dependent_goal_id == dependency.dependent_goal_id,
        models.Dependency.dependency_goal_id == dependency.dependency_goal_id
    ).first()
    
    if db_dependency is None:
        raise HTTPException(status_code=404, detail="Dependency not found")
    
    db.delete(db_dependency)
    db.commit()
    return None