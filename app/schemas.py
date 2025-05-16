# schemas.py
from pydantic import BaseModel, Field
from typing import List, Optional, Set
from datetime import datetime
from enum import Enum

class PriorityEnum(str, Enum):
    high = "High"
    medium = "Medium"
    low = "Low"

# Pydantic schemas for reading data
class SubtaskBase(BaseModel):
    name: str

class SubtaskCreate(SubtaskBase):
    pass

class Subtask(SubtaskBase):
    id: int
    goal_id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        orm_mode = True

class AssigneeBase(BaseModel):
    name: str

class AssigneeCreate(AssigneeBase):
    pass

class Assignee(AssigneeBase):
    id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        orm_mode = True

class GoalBase(BaseModel):
    name: str
    description: Optional[str] = None
    priority: PriorityEnum = PriorityEnum.medium

class GoalCreate(GoalBase):
    assignee_ids: Optional[List[int]] = []
    dependency_ids: Optional[List[int]] = []
    subtasks: Optional[List[SubtaskCreate]] = []

class Goal(GoalBase):
    id: int
    meeting_id: int
    created_at: datetime
    updated_at: datetime
    subtasks: List[Subtask] = []
    assignees: List[Assignee] = []
    
    class Config:
        orm_mode = True

class GoalWithDependencies(Goal):
    dependencies: List[Goal] = []
    dependents: List[Goal] = []

class MeetingBase(BaseModel):
    title: str
    date: Optional[datetime] = None
    summary: Optional[str] = None

class MeetingCreate(MeetingBase):
    pass

class Meeting(MeetingBase):
    id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        orm_mode = True

class MeetingWithGoals(Meeting):
    goals: List[Goal] = []

class DependencyCreate(BaseModel):
    dependent_goal_id: int
    dependency_goal_id: int

class DependencyDelete(BaseModel):
    dependent_goal_id: int
    dependency_goal_id: int