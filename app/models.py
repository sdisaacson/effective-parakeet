# models.py
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Table, Enum, CheckConstraint, func
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
import enum
from datetime import datetime
import pytz

Base = declarative_base()

# Many-to-many association table for goals and assignees
goal_assignees = Table(
    'goal_assignees',
    Base.metadata,
    Column('goal_id', Integer, ForeignKey('goals.id', ondelete='CASCADE'), primary_key=True),
    Column('assignee_id', Integer, ForeignKey('assignees.id', ondelete='CASCADE'), primary_key=True),
    Column('created_at', DateTime(timezone=True), default=lambda: datetime.now(pytz.utc))
)

# Define PriorityLevel enum to match the database type
class PriorityLevel(str, enum.Enum):
    high = "High"
    medium = "Medium"
    low = "Low"

class Meeting(Base):
    __tablename__ = 'meetings'
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    date = Column(DateTime(timezone=True), nullable=True)
    summary = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(pytz.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(pytz.utc), onupdate=lambda: datetime.now(pytz.utc))
    
    # Relationships
    goals = relationship("Goal", back_populates="meeting", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Meeting(id={self.id}, title='{self.title}')>"

class Goal(Base):
    __tablename__ = 'goals'
    
    id = Column(Integer, primary_key=True, index=True)
    meeting_id = Column(Integer, ForeignKey('meetings.id', ondelete='CASCADE'), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    priority = Column(Enum(PriorityLevel), default=PriorityLevel.medium, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(pytz.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(pytz.utc), onupdate=lambda: datetime.now(pytz.utc))
    
    # Relationships
    meeting = relationship("Meeting", back_populates="goals")
    subtasks = relationship("Subtask", back_populates="goal", cascade="all, delete-orphan")
    assignees = relationship("Assignee", secondary=goal_assignees, back_populates="goals")
    
    # Dependents are goals that depend on this goal
    dependents = relationship(
        "Goal",
        secondary="dependencies",
        primaryjoin="Goal.id==dependencies.c.dependency_goal_id",
        secondaryjoin="Goal.id==dependencies.c.dependent_goal_id",
        backref="dependencies"
    )
    
    def __repr__(self):
        return f"<Goal(id={self.id}, name='{self.name}')>"

class Subtask(Base):
    __tablename__ = 'subtasks'
    
    id = Column(Integer, primary_key=True, index=True)
    goal_id = Column(Integer, ForeignKey('goals.id', ondelete='CASCADE'), nullable=False)
    name = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(pytz.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(pytz.utc), onupdate=lambda: datetime.now(pytz.utc))
    
    # Relationships
    goal = relationship("Goal", back_populates="subtasks")
    
    def __repr__(self):
        return f"<Subtask(id={self.id}, name='{self.name}')>"

class Assignee(Base):
    __tablename__ = 'assignees'
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, unique=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(pytz.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(pytz.utc), onupdate=lambda: datetime.now(pytz.utc))
    
    # Relationships
    goals = relationship("Goal", secondary=goal_assignees, back_populates="assignees")
    
    def __repr__(self):
        return f"<Assignee(id={self.id}, name='{self.name}')>"

# Dependencies association table
class Dependency(Base):
    __tablename__ = 'dependencies'
    
    dependent_goal_id = Column(Integer, ForeignKey('goals.id', ondelete='CASCADE'), primary_key=True)
    dependency_goal_id = Column(Integer, ForeignKey('goals.id', ondelete='CASCADE'), primary_key=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(pytz.utc))
    
    # Prevent a goal from depending on itself
    __table_args__ = (
        CheckConstraint('dependent_goal_id != dependency_goal_id', name='no_self_dependency'),
    )