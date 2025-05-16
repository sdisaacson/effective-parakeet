// Main JavaScript for the Action Item Extractor with Cytoscape.js graph visualization
// Add these declarations at the top of your file, right after the first comment line
// Global function references
let globalRenderMeetingInfo;
let globalGetAllAssignees;
let globalRenderTeamMembers;
let globalRenderKnowledgeGraph;
let globalRenderGoalCard;
let globalRenderGoalRow;
let globalInitGraphControls;

document.addEventListener('DOMContentLoaded', function() {
    // Form submission handler
    const form = document.getElementById('transcript-form');
    const loadingIndicator = document.getElementById('loading');
    const resultsContainer = document.getElementById('results-container');
    const toggleViewBtn = document.getElementById('toggle-view-btn');
    const goalsGrid = document.getElementById('goals-grid');
    const listView = document.getElementById('list-view');
    const goalsTableBody = document.getElementById('goals-table-body');
    
    // Global storage for the current data
    let currentMeetingData = null;
    let currentGoalsData = [];
    
    // Cytoscape instance for graph visualization
    let cy = null;
    
    // Toggle between grid and list view
    toggleViewBtn.addEventListener('click', function() {
        if (goalsGrid.style.display === 'none') {
            goalsGrid.style.display = 'flex';
            listView.style.display = 'none';
            toggleViewBtn.innerHTML = '<i class="fas fa-th-list me-1"></i>Toggle View';
        } else {
            goalsGrid.style.display = 'none';
            listView.style.display = 'block';
            toggleViewBtn.innerHTML = '<i class="fas fa-th me-1"></i>Toggle View';
        }
    });
    
    // Form submission
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        // Show loading indicator
        loadingIndicator.style.display = 'block';
        resultsContainer.style.display = 'none';
        
        const transcript = document.getElementById('transcript').value;
        
        try {
            const formData = new FormData();
            formData.append('transcript', transcript);
            
            console.log('Submitting transcript to /process endpoint');
            const response = await fetch('/process', {
                method: 'POST',
                body: formData
            });
            
            console.log('Response status:', response.status);
            const data = await response.json();
            console.log('Response data:', data);
            
            if (response.ok) {
                // Make sure data.goals and data.meeting are valid
                if (!data.goals || !Array.isArray(data.goals) || !data.meeting) {
                    console.error('Invalid data structure:', data);
                    throw new Error('Invalid response data structure');
                }
                
                // Process and display the results with meeting info
                renderResults(data.goals, data.meeting);
                
                // Hide loading indicator, show results
                loadingIndicator.style.display = 'none';
                resultsContainer.style.display = 'block';
                
                // Show the data editing section explicitly
                document.getElementById('data-editing-section').style.display = 'block';
            } else {
                // Handle errors
                console.error('API error:', data.detail || 'Unknown error');
                throw new Error(data.detail || 'An error occurred');
            }
        } catch (error) {
            console.error('Error processing transcript:', error);
            loadingIndicator.style.display = 'none';
            alert(`Error: ${error.message}`);
        }
    });

    // Render meeting information
    function renderMeetingInfo(meeting) {
        console.log('Rendering meeting info:', meeting);
        const meetingContainer = document.getElementById('meeting-info-container');
        
        if (meeting) {
            // Show the container
            meetingContainer.style.display = 'block';
            
            // Set meeting title
            const titleElement = document.getElementById('meeting-title');
            titleElement.textContent = meeting.title || 'Untitled Meeting';
            
            // Set meeting date if available
            const dateElement = document.getElementById('meeting-date');
            if (meeting.date) {
                dateElement.innerHTML = `<i class="fas fa-calendar-alt me-2"></i>${meeting.date}`;
            } else {
                dateElement.innerHTML = ''; // No date available
            }
            
            // Set meeting summary
            const summaryElement = document.getElementById('meeting-summary');
            summaryElement.textContent = meeting.summary || 'No summary available';
        } else {
            // Hide the container if no meeting info
            meetingContainer.style.display = 'none';
        }
    }
    
    // Render the results
    function renderResults(goals, meeting) {
        console.log("Rendering results with:", { goals, meeting });
        
        // Clear previous results
        goalsGrid.innerHTML = '';
        goalsTableBody.innerHTML = '';
        document.getElementById('team-container').innerHTML = '';
        
        // Render meeting information if available
        if (meeting) {
            renderMeetingInfo(meeting);
        }
        
        // Get all assignees
        const allAssignees = getAllAssignees(goals);
        
        // Render team members section
        renderTeamMembers(allAssignees, goals);
        
        // Render knowledge graph visualization
        renderKnowledgeGraph(goals, allAssignees);
        
        // Render goals in grid view
        goals.forEach(goal => {
            renderGoalCard(goal, goals);
            renderGoalRow(goal, goals);
        });
        
        // Initialize zoom and layout buttons
        initGraphControls();
        
        // Display data tables for editing
        displayDataTables(meeting, goals);
    }
    
    // Extract all unique assignees
    function getAllAssignees(goals) {
        const assigneesSet = new Set();
        goals.forEach(goal => {
            goal.assignees.forEach(assignee => {
                assigneesSet.add(assignee);
            });
        });
        return Array.from(assigneesSet);
    }
    
    // Render team members section
    function renderTeamMembers(assignees, goals) {
        const teamContainer = document.getElementById('team-container');
        
        assignees.forEach(person => {
            const personGoals = goals.filter(goal => 
                goal.assignees.includes(person)
            );
            
            const personElement = document.createElement('div');
            personElement.className = 'col-md-4 mb-3';
            personElement.innerHTML = `
                <div class="team-member-card">
                    <h5><i class="fas fa-user-circle me-2"></i>${person}</h5>
                    <div class="small mt-2">Assigned to:</div>
                    <div class="mt-1">
                        ${personGoals.map(goal => `
                            <span class="badge bg-light text-dark me-1 mb-1">
                                #${goal.id}: ${goal.name.length > 20 ? goal.name.substring(0, 20) + '...' : goal.name}
                            </span>
                        `).join('')}
                    </div>
                </div>
            `;
            
            teamContainer.appendChild(personElement);
        });
    }
    
    // Render knowledge graph using Cytoscape.js
    function renderKnowledgeGraph(goals, assignees) {
        // Initialize the Cytoscape instance
        cy = cytoscape({
            container: document.getElementById('cy-container'),
            style: [
                // Node styles
                {
                    selector: 'node',
                    style: {
                        'background-color': '#f8f9fa',
                        'border-width': 2,
                        'border-color': '#6c757d',
                        'label': 'data(label)',
                        'text-wrap': 'wrap',
                        'text-max-width': '100px',
                        'font-size': '10px',
                        'text-valign': 'center',
                        'text-halign': 'center',
                        'color': '#212529',
                        'text-outline-width': 2,
                        'text-outline-color': '#f8f9fa'
                    }
                },
                // Goal nodes
                {
                    selector: 'node.goal',
                    style: {
                        'shape': 'roundrectangle',
                        'width': 120,
                        'height': 50,
                        'border-width': 2
                    }
                },
                // High priority goals
                {
                    selector: 'node.goal.high-priority',
                    style: {
                        'border-color': '#dc3545',
                        'border-width': 3,
                        'background-color': '#FEF2F2'
                    }
                },
                // Medium priority goals
                {
                    selector: 'node.goal.medium-priority',
                    style: {
                        'border-color': '#fd7e14',
                        'background-color': '#FFF7ED'
                    }
                },
                // Low priority goals
                {
                    selector: 'node.goal.low-priority',
                    style: {
                        'border-color': '#0d6efd',
                        'background-color': '#EFF6FF'
                    }
                },
                // Subtask nodes
                {
                    selector: 'node.subtask',
                    style: {
                        'shape': 'round-rectangle',
                        'width': 100,
                        'height': 30,
                        'background-color': '#e9ecef',
                        'border-color': '#adb5bd'
                    }
                },
                // Assignee nodes
                {
                    selector: 'node.assignee',
                    style: {
                        'shape': 'ellipse',
                        'width': 40,
                        'height': 40,
                        'background-color': '#cfe2ff',
                        'border-color': '#0d6efd',
                        'text-outline-color': '#cfe2ff'
                    }
                },
                // Edge styles
                {
                    selector: 'edge',
                    style: {
                        'width': 2,
                        'line-color': '#adb5bd',
                        'target-arrow-color': '#adb5bd',
                        'target-arrow-shape': 'triangle',
                        'curve-style': 'bezier'
                    }
                },
                // Dependency edges
                {
                    selector: 'edge.dependency',
                    style: {
                        'line-color': '#fd7e14',
                        'target-arrow-color': '#fd7e14',
                        'line-style': 'dashed'
                    }
                },
                // Assignment edges
                {
                    selector: 'edge.assignment',
                    style: {
                        'line-color': '#0d6efd',
                        'target-arrow-color': '#0d6efd',
                        'line-style': 'solid',
                        'target-arrow-shape': 'none'
                    }
                },
                // Subtask edges
                {
                    selector: 'edge.subtask',
                    style: {
                        'line-color': '#6c757d',
                        'target-arrow-color': '#6c757d',
                        'line-style': 'solid'
                    }
                },
                // Highlighted elements
                {
                    selector: '.highlighted',
                    style: {
                        'background-color': '#ffc107',
                        'border-color': '#fd7e14',
                        'border-width': 3,
                        'line-color': '#fd7e14',
                        'target-arrow-color': '#fd7e14',
                        'transition-property': 'background-color, border-color, line-color, target-arrow-color',
                        'transition-duration': '0.3s'
                    }
                }
            ],
            layout: {
                name: 'cose',
                padding: 50,
                nodeDimensionsIncludeLabels: true,
                randomize: true,
                componentSpacing: 100,
                nodeRepulsion: 8000,
                nodeOverlap: 20,
                idealEdgeLength: 100,
                edgeElasticity: 100,
                nestingFactor: 5,
                gravity: 50,
                numIter: 1000,
                initialTemp: 200,
                coolingFactor: 0.95,
                minTemp: 1.0
            },
            wheelSensitivity: 0.3
        });
        
        // Add goal nodes
        goals.forEach(goal => {
            cy.add({
                group: 'nodes',
                data: {
                    id: `goal-${goal.id}`,
                    label: `#${goal.id}: ${goal.name}`,
                    priority: goal.priority,
                    description: goal.description,
                    type: 'goal'
                },
                classes: `goal ${goal.priority.toLowerCase()}-priority`
            });
            
            // Add subtask nodes and edges
            if (goal.subtasks && goal.subtasks.length > 0) {
                goal.subtasks.forEach(subtask => {
                    // Create a unique ID for subtasks by combining goal ID and subtask ID
                    const uniqueSubtaskId = `subtask-${goal.id}-${subtask.id}`;
                    
                    cy.add({
                        group: 'nodes',
                        data: {
                            id: uniqueSubtaskId,
                            label: subtask.name,
                            type: 'subtask'
                        },
                        classes: 'subtask'
                    });
                    
                    // Add edge from goal to subtask (with updated target ID)
                    cy.add({
                        group: 'edges',
                        data: {
                            id: `goal-${goal.id}-subtask-${subtask.id}`,
                            source: `goal-${goal.id}`,
                            target: uniqueSubtaskId,
                            type: 'subtask'
                        },
                        classes: 'subtask'
                    });
                });
            }
            
            // Add assignee nodes and edges
            goal.assignees.forEach(assignee => {
                // Check if assignee node already exists
                if (!cy.getElementById(`assignee-${assignee}`).length) {
                    cy.add({
                        group: 'nodes',
                        data: {
                            id: `assignee-${assignee}`,
                            label: assignee,
                            type: 'assignee'
                        },
                        classes: 'assignee'
                    });
                }
                
                // Add edge from goal to assignee
                cy.add({
                    group: 'edges',
                    data: {
                        id: `goal-${goal.id}-assignee-${assignee}`,
                        source: `goal-${goal.id}`,
                        target: `assignee-${assignee}`,
                        type: 'assignment'
                    },
                    classes: 'assignment'
                });
            });
            
            // Add dependency edges
            if (goal.dependencies && goal.dependencies.length > 0) {
                goal.dependencies.forEach(depId => {
                    cy.add({
                        group: 'edges',
                        data: {
                            id: `goal-${depId}-dep-goal-${goal.id}`,
                            source: `goal-${depId}`,
                            target: `goal-${goal.id}`,
                            type: 'dependency'
                        },
                        classes: 'dependency'
                    });
                });
            }
        });
        
        // Add hover interactions
        cy.on('mouseover', 'node', function(e) {
            const node = e.target;
            node.addClass('highlighted');
            
            // Highlight connected nodes and edges
            const connectedEdges = node.connectedEdges();
            connectedEdges.addClass('highlighted');
            
            const connectedNodes = connectedEdges.connectedNodes().not(node);
            connectedNodes.addClass('highlighted');
            
            // Show tooltip
            showTooltip(node);
        });
        
        cy.on('mouseout', 'node', function(e) {
            const node = e.target;
            node.removeClass('highlighted');
            
            // Remove highlight from connected elements
            const connectedEdges = node.connectedEdges();
            connectedEdges.removeClass('highlighted');
            
            const connectedNodes = connectedEdges.connectedNodes().not(node);
            connectedNodes.removeClass('highlighted');
            
            // Hide tooltip
            hideTooltip();
        });
        
        // Add click handler for goals
        cy.on('tap', 'node.goal', function(e) {
            const node = e.target;
            const goalId = parseInt(node.id().replace('goal-', ''));
            highlightGoalInUI(goalId);
        });
        
        // Run layout
        cy.layout({name: 'cose'}).run();
    }
    
    // Show tooltip for node
    function showTooltip(node) {
        const data = node.data();
        let content = '';
        
        if (data.type === 'goal') {
            content = `
                <strong>${data.label}</strong><br>
                Priority: ${data.priority}<br>
                ${data.description.substring(0, 100)}${data.description.length > 100 ? '...' : ''}
            `;
        } else if (data.type === 'subtask') {
            content = `<strong>Subtask:</strong> ${data.label}`;
        } else if (data.type === 'assignee') {
            content = `<strong>Assignee:</strong> ${data.label}`;
        }
        
        // Create or update tooltip
        let tooltip = document.querySelector('.cy-tooltip');
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.className = 'cy-tooltip';
            document.body.appendChild(tooltip);
        }
        
        tooltip.innerHTML = content;
        
        // Position tooltip near node
        const position = node.renderedPosition();
        const containerRect = document.getElementById('cy-container').getBoundingClientRect();
        
        tooltip.style.left = (containerRect.left + position.x + 20) + 'px';
        tooltip.style.top = (containerRect.top + position.y - 30) + 'px';
        tooltip.style.display = 'block';
    }
    
    // Hide tooltip
    function hideTooltip() {
        const tooltip = document.querySelector('.cy-tooltip');
        if (tooltip) {
            tooltip.style.display = 'none';
        }
    }
    
    // Initialize graph control buttons
    function initGraphControls() {
        // Zoom controls
        document.getElementById('zoom-in-btn').addEventListener('click', function() {
            cy.zoom(cy.zoom() * 1.2);
        });
        
        document.getElementById('zoom-out-btn').addEventListener('click', function() {
            cy.zoom(cy.zoom() / 1.2);
        });
        
        document.getElementById('fit-btn').addEventListener('click', function() {
            cy.fit();
        });
        
        // Layout controls
        document.getElementById('layout-circle-btn').addEventListener('click', function() {
            setActiveLayoutButton('layout-circle-btn');
            cy.layout({ name: 'circle', padding: 50 }).run();
        });
        
        document.getElementById('layout-grid-btn').addEventListener('click', function() {
            setActiveLayoutButton('layout-grid-btn');
            cy.layout({ name: 'grid', padding: 50 }).run();
        });
        
        document.getElementById('layout-cose-btn').addEventListener('click', function() {
            setActiveLayoutButton('layout-cose-btn');
            cy.layout({ 
                name: 'cose',
                padding: 50,
                nodeDimensionsIncludeLabels: true,
                componentSpacing: 100,
                nodeRepulsion: 8000
            }).run();
        });
    }
    
    // Set active layout button
    function setActiveLayoutButton(activeId) {
        ['layout-circle-btn', 'layout-grid-btn', 'layout-cose-btn'].forEach(id => {
            const btn = document.getElementById(id);
            if (id === activeId) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }
    
    // Highlight goal in UI when clicked in graph
    function highlightGoalInUI(goalId) {
        // Find goal card and switch to grid view if needed
        const goalCard = document.querySelector(`.goal-card[data-goal-id="${goalId}"]`);
        if (goalCard) {
            document.getElementById('goals-grid').style.display = 'flex';
            document.getElementById('list-view').style.display = 'none';
            document.getElementById('toggle-view-btn').innerHTML = '<i class="fas fa-th-list me-1"></i>Toggle View';
            
            // Scroll to the goal card
            goalCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            // Highlight the card
            goalCard.classList.add('border', 'border-primary');
            setTimeout(() => {
                goalCard.classList.remove('border', 'border-primary');
            }, 2000);
        }
    }
    
    // Render a goal card for grid view
    function renderGoalCard(goal, allGoals) {
        const priorityClass = `priority-${goal.priority.toLowerCase()}`;
        const cardColumn = document.createElement('div');
        cardColumn.className = 'col-md-6 mb-3';
        
        // Create goal card
        const card = document.createElement('div');
        card.className = `card shadow-sm goal-card ${priorityClass}`;
        card.setAttribute('data-goal-id', goal.id);
        card.addEventListener('click', function() {
            // Highlight corresponding node in graph
            if (cy) {
                const node = cy.getElementById(`goal-${goal.id}`);
                if (node.length > 0) {
                    // Center view on node
                    cy.animate({
                        fit: {
                            eles: node,
                            padding: 100
                        },
                        duration: 500
                    });
                    
                    // Highlight node
                    node.addClass('highlighted');
                    setTimeout(() => {
                        node.removeClass('highlighted');
                    }, 2000);
                }
            }
        });
        
        // Create card content
        card.innerHTML = `
            <div class="card-body">
                <div class="d-flex justify-content-between align-items-start mb-2">
                    <h5 class="card-title mb-0">#${goal.id}: ${goal.name}</h5>
                    <span class="badge ${priorityClass.replace('priority-', 'badge-')} rounded-pill">${goal.priority}</span>
                </div>
                
                <p class="card-text small text-muted mb-3">${goal.description}</p>
                
                <div class="mb-3">
                    <div class="small fw-bold mb-1"><i class="fas fa-users me-1"></i>Assignees:</div>
                    <div>
                        ${goal.assignees.map(assignee => `
                            <span class="assignee-tag">
                                <i class="fas fa-user-circle me-1"></i>${assignee}
                            </span>
                        `).join('')}
                    </div>
                </div>
                
                ${goal.subtasks && goal.subtasks.length > 0 ? `
                    <div class="mb-3">
                        <div class="small fw-bold mb-1"><i class="fas fa-tasks me-1"></i>Subtasks:</div>
                        <div>
                            ${goal.subtasks.map(subtask => `
                                <div class="subtask-item">
                                    <span class="me-2">•</span>${subtask.name}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
                
                ${goal.dependencies && goal.dependencies.length > 0 ? `
                    <div>
                        <div class="small fw-bold mb-1"><i class="fas fa-project-diagram me-1"></i>Dependencies:</div>
                        <div>
                            ${goal.dependencies.map(depId => {
                                const depGoal = allGoals.find(t => t.id === depId);
                                return depGoal ? `
                                    <span class="dependency-tag">
                                        #${depGoal.id}: ${depGoal.name.length > 15 ? depGoal.name.substring(0, 15) + '...' : depGoal.name}
                                    </span>
                                ` : '';
                            }).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
        
        cardColumn.appendChild(card);
        goalsGrid.appendChild(cardColumn);
    }
    
    // Render a goal row for list view
    function renderGoalRow(goal, allGoals) {
        const row = document.createElement('tr');
        row.setAttribute('data-goal-id', goal.id);
        row.addEventListener('click', function() {
            // Highlight corresponding node in graph
            if (cy) {
                const node = cy.getElementById(`goal-${goal.id}`);
                if (node.length > 0) {
                    // Center view on node
                    cy.animate({
                        fit: {
                            eles: node,
                            padding: 100
                        },
                        duration: 500
                    });
                    
                    // Highlight node
                    node.addClass('highlighted');
                    setTimeout(() => {
                        node.removeClass('highlighted');
                    }, 2000);
                }
            }
        });
        
        row.innerHTML = `
            <td>${goal.id}</td>
            <td>
                <strong>${goal.name}</strong>
                <div class="small text-muted">${goal.description.substring(0, 50)}${goal.description.length > 50 ? '...' : ''}</div>
            </td>
            <td>
                <span class="badge ${goal.priority === 'High' ? 'bg-danger' : goal.priority === 'Medium' ? 'bg-warning text-dark' : 'bg-primary'}">${goal.priority}</span>
            </td>
            <td>${goal.assignees.join(', ')}</td>
            <td>
                ${goal.dependencies && goal.dependencies.length > 0 ? 
                    goal.dependencies.map(depId => {
                        const depGoal = allGoals.find(t => t.id === depId);
                        return depGoal ? `#${depId} (${depGoal.name.substring(0, 15)}${depGoal.name.length > 15 ? '...' : ''})` : `#${depId}`;
                    }).join(', ') 
                    : 'None'}
            </td>
            <td>
                <button class="btn btn-sm btn-outline-primary" onclick="showGoalInGraph(${goal.id})">
                    <i class="fas fa-eye"></i>
                </button>
            </td>
        `;
        
        goalsTableBody.appendChild(row);
    }
    globalRenderMeetingInfo = renderMeetingInfo;
    globalGetAllAssignees = getAllAssignees;
    globalRenderTeamMembers = renderTeamMembers;
    globalRenderKnowledgeGraph = renderKnowledgeGraph;
    globalRenderGoalCard = renderGoalCard;
    globalRenderGoalRow = renderGoalRow;
    globalInitGraphControls = initGraphControls;
});

// Function to show goal in graph from list view
function showGoalInGraph(goalId) {
    event.stopPropagation(); // Prevent row click handler from firing
    
    const cy = document.querySelector('#cy-container').cy;
    if (cy) {
        const node = cy.getElementById(`goal-${goalId}`);
        if (node.length > 0) {
            // Center view on node
            cy.animate({
                fit: {
                    eles: node,
                    padding: 100
                },
                duration: 500
            });
            
            // Highlight node
            node.addClass('highlighted');
            setTimeout(() => {
                node.removeClass('highlighted');
            }, 2000);
        }
    }
}
// Data Table Functionality

// Global variables are now defined at the top of the script.js file
// let currentMeetingData = null;
// let currentGoalsData = []; 

// Function to initialize data tables
function initDataTables() {
    // Add event listener for the refresh button
    document.getElementById('refresh-viz-btn').addEventListener('click', function() {
        refreshVisualization();
    });
}

// Function to display data tables
function displayDataTables(meeting, goals) {
    console.log("Displaying data tables with:", { meeting, goals });
    
    // Store the current data globally
    currentMeetingData = meeting;
    currentGoalsData = goals;
    
    // Show the data editing section
    document.getElementById('data-editing-section').style.display = 'block';
    
    // Render meeting data
    renderMeetingTable(meeting);
    
    // Render goals data
    renderGoalsTable(goals);
    
    // Add the "Add Goal" button
    enhanceGoalsTableWithAddButton();
}

// Render meeting table
function renderMeetingTable(meeting) {
    const tableBody = document.getElementById('meeting-table-body');
    tableBody.innerHTML = '';
    
    const row = document.createElement('tr');
    row.innerHTML = `
        <td>${meeting.id}</td>
        <td contenteditable="true" data-field="title">${meeting.title}</td>
        <td contenteditable="true" data-field="date">${meeting.date || ''}</td>
        <td contenteditable="true" data-field="summary">${meeting.summary}</td>
        <td>
            <button class="btn btn-sm btn-success save-meeting-btn">
                <i class="fas fa-save"></i>
            </button>
        </td>
    `;
    
    // Add event listener for the save button
    row.querySelector('.save-meeting-btn').addEventListener('click', function() {
        saveMeetingChanges(row, meeting);
    });
    
    // Add event listeners for contenteditable cells
    const editableCells = row.querySelectorAll('[contenteditable="true"]');
    editableCells.forEach(cell => {
        cell.addEventListener('blur', function() {
            const field = this.dataset.field;
            meeting[field] = this.textContent;
        });
    });
    
    tableBody.appendChild(row);
}

// Render goals table
// Render goals table with subtasks
// Update the renderGoalsTable function to include a delete button
// Update the renderGoalsTable function to include dependency management
function renderGoalsTable(goals) {
    console.log("Rendering goals table with:", goals);
    const tableBody = document.getElementById('goals-edit-table-body');
    tableBody.innerHTML = '';
    
    goals.forEach(goal => {
        // Create the main goal row
        const row = document.createElement('tr');
        row.className = 'goal-row';
        row.setAttribute('data-goal-id', goal.id);
        row.innerHTML = `
            <td>${goal.id}</td>
            <td contenteditable="true" data-field="name">${goal.name}</td>
            <td contenteditable="true" data-field="description">${goal.description}</td>
            <td>
                <select class="form-select form-select-sm" data-field="priority">
                    <option value="High" ${goal.priority === 'High' ? 'selected' : ''}>High</option>
                    <option value="Medium" ${goal.priority === 'Medium' ? 'selected' : ''}>Medium</option>
                    <option value="Low" ${goal.priority === 'Low' ? 'selected' : ''}>Low</option>
                </select>
            </td>
            <td contenteditable="true" data-field="assignees">${goal.assignees.join(', ')}</td>
            <td>${goal.meeting_id || ''}</td>
            <td>
                <div class="d-flex">
                    <button class="btn btn-sm btn-success save-goal-btn me-1" title="Save changes">
                        <i class="fas fa-save"></i>
                    </button>
                    <button class="btn btn-sm btn-info toggle-subtasks-btn me-1" title="Show/Hide Subtasks">
                        <i class="fas fa-tasks"></i>
                        <span class="subtask-count badge bg-secondary ms-1">${goal.subtasks?.length || 0}</span>
                    </button>
                    <button class="btn btn-sm btn-danger remove-goal-btn" title="Delete Goal">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            </td>
        `;
        
        // Add event listener for the save button
        row.querySelector('.save-goal-btn').addEventListener('click', function() {
            saveGoalChanges(row, goal);
        });
        
        // Add event listener for the remove button
        row.querySelector('.remove-goal-btn').addEventListener('click', function() {
            removeGoal(goal.id);
        });
        
        // Add event listeners for contenteditable cells
        const editableCells = row.querySelectorAll('[contenteditable="true"]');
        editableCells.forEach(cell => {
            cell.addEventListener('blur', function() {
                const field = this.dataset.field;
                if (field === 'assignees') {
                    // Convert comma-separated string to array
                    goal[field] = this.textContent.split(',').map(item => item.trim()).filter(item => item);
                } else {
                    goal[field] = this.textContent;
                }
            });
        });
        
        // Add event listener for priority dropdown
        const prioritySelect = row.querySelector('select[data-field="priority"]');
        prioritySelect.addEventListener('change', function() {
            goal.priority = this.value;
        });
        
        // Add the goal row to the table
        tableBody.appendChild(row);
        
        // Create subtasks row
        const subtasksRow = document.createElement('tr');
        subtasksRow.className = 'subtasks-row';
        subtasksRow.style.display = 'none'; // Hidden by default
        subtasksRow.setAttribute('data-goal-id', goal.id);
        
        // Create a cell that spans the entire table
        const subtasksCell = document.createElement('td');
        subtasksCell.setAttribute('colspan', '7');
        subtasksCell.className = 'p-3 bg-light';
        
        // Create subtasks content
        const subtasksContent = document.createElement('div');
        subtasksContent.className = 'subtasks-container';
        
        // Add header and "Add New" button
        subtasksContent.innerHTML = `
            <div class="d-flex justify-content-between align-items-center mb-3">
                <h5 class="mb-0"><i class="fas fa-tasks me-2"></i>Subtasks for Goal #${goal.id}</h5>
                <button class="btn btn-sm btn-primary add-subtask-btn">
                    <i class="fas fa-plus me-1"></i>Add New Subtask
                </button>
            </div>
            <div class="subtasks-list">
                ${goal.subtasks && goal.subtasks.length > 0 ? renderSubtasksList(goal.subtasks, goal.id) : '<p class="text-muted">No subtasks yet.</p>'}
            </div>
        `;
        
        subtasksCell.appendChild(subtasksContent);
        subtasksRow.appendChild(subtasksCell);
        tableBody.appendChild(subtasksRow);
        
        // Add dependency management UI to the subtasks row
        enhanceSubtasksRowWithDependencies(subtasksRow, goal);
        
        // Add event listener for toggle subtasks button
        row.querySelector('.toggle-subtasks-btn').addEventListener('click', function() {
            if (subtasksRow.style.display === 'none') {
                subtasksRow.style.display = 'table-row';
                this.querySelector('i').className = 'fas fa-chevron-up';
            } else {
                subtasksRow.style.display = 'none';
                this.querySelector('i').className = 'fas fa-tasks';
            }
        });
        
        // Add event listener for "Add New Subtask" button
        subtasksRow.querySelector('.add-subtask-btn').addEventListener('click', function() {
            addNewSubtask(goal, subtasksRow.querySelector('.subtasks-list'));
        });
    });
}

// Helper function to render subtasks list
function renderSubtasksList(subtasks, goalId) {
    return `
        <table class="table table-sm subtasks-table">
            <thead>
                <tr>
                    <th width="60">ID</th>
                    <th>Name</th>
                    <th width="100">Actions</th>
                </tr>
            </thead>
            <tbody>
                ${subtasks.map(subtask => `
                    <tr data-subtask-id="${subtask.id}">
                        <td>${subtask.id}</td>
                        <td contenteditable="true" data-field="name">${subtask.name}</td>
                        <td>
                            <button class="btn btn-sm btn-success save-subtask-btn me-1" title="Save changes">
                                <i class="fas fa-save"></i>
                            </button>
                            <button class="btn btn-sm btn-danger remove-subtask-btn" title="Remove subtask">
                                <i class="fas fa-trash-alt"></i>
                            </button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

// Function to add a new subtask
function addNewSubtask(goal, container) {
    if (!goal.subtasks) {
        goal.subtasks = [];
    }
    
    // Generate a new ID for the subtask 
    // (in a real app, this would come from the backend)
    const newId = goal.subtasks.length > 0 
        ? Math.max(...goal.subtasks.map(st => st.id)) + 1 
        : 1;
    
    // Create the new subtask
    const newSubtask = {
        id: newId,
        name: `New Subtask ${newId}`
    };
    
    // Add to the goal's subtasks array
    goal.subtasks.push(newSubtask);
    
    // Update the UI
    container.innerHTML = renderSubtasksList(goal.subtasks, goal.id);
    
    // Update subtask count badge
    const goalRow = document.querySelector(`.goal-row[data-goal-id="${goal.id}"]`);
    if (goalRow) {
        const badge = goalRow.querySelector('.subtask-count');
        if (badge) {
            badge.textContent = goal.subtasks.length;
        }
    }
    
    // Add event listeners to new elements
    setupSubtaskEventListeners(container, goal);
    
    // Show a confirmation message
    showToast('New subtask added!');
}

// Set up event listeners for subtask elements
function setupSubtaskEventListeners(container, goal) {
    // Save buttons
    container.querySelectorAll('.save-subtask-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const row = this.closest('tr');
            const subtaskId = parseInt(row.getAttribute('data-subtask-id'));
            const nameCell = row.querySelector('[data-field="name"]');
            
            // Find and update the subtask
            const subtask = goal.subtasks.find(st => st.id === subtaskId);
            if (subtask) {
                subtask.name = nameCell.textContent;
                showToast('Subtask updated!');
            }
        });
    });
    
    // Remove buttons
    container.querySelectorAll('.remove-subtask-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const row = this.closest('tr');
            const subtaskId = parseInt(row.getAttribute('data-subtask-id'));
            
            // Remove the subtask from the array
            const index = goal.subtasks.findIndex(st => st.id === subtaskId);
            if (index !== -1) {
                goal.subtasks.splice(index, 1);
                
                // Update the UI
                container.innerHTML = goal.subtasks.length > 0 
                    ? renderSubtasksList(goal.subtasks, goal.id) 
                    : '<p class="text-muted">No subtasks yet.</p>';
                
                // If we still have subtasks, reattach event listeners
                if (goal.subtasks.length > 0) {
                    setupSubtaskEventListeners(container, goal);
                }
                
                // Update subtask count badge
                const goalRow = document.querySelector(`.goal-row[data-goal-id="${goal.id}"]`);
                if (goalRow) {
                    const badge = goalRow.querySelector('.subtask-count');
                    if (badge) {
                        badge.textContent = goal.subtasks.length;
                    }
                }
                
                showToast('Subtask removed!');
            }
        });
    });
    
    // Edit cells
    container.querySelectorAll('[contenteditable="true"]').forEach(cell => {
        cell.addEventListener('blur', function() {
            const row = this.closest('tr');
            const subtaskId = parseInt(row.getAttribute('data-subtask-id'));
            const field = this.dataset.field;
            
            // Find and update the subtask
            const subtask = goal.subtasks.find(st => st.id === subtaskId);
            if (subtask) {
                subtask[field] = this.textContent;
            }
        });
    });
}
// Add a dependency management UI to the subtasks row
function enhanceSubtasksRowWithDependencies(subtasksRow, goal) {
    // Create a container for the dependencies section
    const dependenciesContainer = document.createElement('div');
    dependenciesContainer.className = 'dependencies-container mt-4';
    
    // Get available goals that can be dependencies (all goals except this one and any that would create cycles)
    const availableGoals = currentGoalsData.filter(g => 
        g.id !== goal.id && !wouldCreateCircularDependency(goal.id, g.id)
    );
    
    // Create the dependencies section HTML
    dependenciesContainer.innerHTML = `
        <div class="dependencies-header d-flex justify-content-between align-items-center mb-3">
            <h5 class="mb-0"><i class="fas fa-project-diagram me-2"></i>Dependencies for Goal #${goal.id}</h5>
        </div>
        
        <div class="dependencies-content">
            <!-- Current dependencies -->
            <div class="current-dependencies mb-3">
                <h6>Current Dependencies:</h6>
                <div class="dependency-list">
                    ${!goal.dependencies || goal.dependencies.length === 0 ? 
                        '<p class="text-muted">No dependencies yet.</p>' :
                        `<ul class="list-group">
                            ${goal.dependencies.map(depId => {
                                const depGoal = currentGoalsData.find(g => g.id === depId);
                                return depGoal ? 
                                    `<li class="list-group-item d-flex justify-content-between align-items-center">
                                        <span>#${depGoal.id}: ${depGoal.name}</span>
                                        <button class="btn btn-sm btn-danger remove-dependency-btn" data-dependency-id="${depGoal.id}">
                                            <i class="fas fa-times"></i> Remove
                                        </button>
                                    </li>` : '';
                            }).join('')}
                        </ul>`
                    }
                </div>
            </div>
            
            <!-- Add new dependency -->
            <div class="add-dependency">
                <h6>Add New Dependency:</h6>
                ${availableGoals.length === 0 ? 
                    '<p class="text-muted">No available goals to add as dependencies.</p>' :
                    `<div class="input-group">
                        <select class="form-select" id="dependency-select-${goal.id}">
                            <option value="" selected disabled>Select a goal...</option>
                            ${availableGoals.map(g => 
                                `<option value="${g.id}">#${g.id}: ${g.name}</option>`
                            ).join('')}
                        </select>
                        <button class="btn btn-primary add-dependency-btn" type="button">
                            <i class="fas fa-plus"></i> Add
                        </button>
                    </div>`
                }
            </div>
        </div>
    `;
    
    // Add this container to the subtasks cell
    const subtasksCell = subtasksRow.querySelector('td');
    subtasksCell.appendChild(dependenciesContainer);
    
    // Add event listeners for dependency buttons
    if (goal.dependencies && goal.dependencies.length > 0) {
        dependenciesContainer.querySelectorAll('.remove-dependency-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const dependencyId = parseInt(this.getAttribute('data-dependency-id'));
                removeDependency(goal.id, dependencyId);
            });
        });
    }
    
    if (availableGoals.length > 0) {
        const addBtn = dependenciesContainer.querySelector('.add-dependency-btn');
        const select = dependenciesContainer.querySelector(`#dependency-select-${goal.id}`);
        
        addBtn.addEventListener('click', function() {
            const dependencyId = parseInt(select.value);
            if (dependencyId) {
                addDependency(goal.id, dependencyId);
            } else {
                showToast('Please select a goal to add as dependency');
            }
        });
    }
    
    return dependenciesContainer;
}
// Add a button above the goals table for adding new goals

function enhanceGoalsTableWithAddButton() {
    const tableContainer = document.getElementById('goals-edit-table').closest('.table-responsive');
    
    // Check if we already added the button to avoid duplicates
    if (!document.getElementById('add-goal-btn')) {
        // Create button container
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'd-flex justify-content-end mb-3';
        
        // Create the add button
        const addButton = document.createElement('button');
        addButton.id = 'add-goal-btn';
        addButton.className = 'btn btn-primary';
        addButton.innerHTML = '<i class="fas fa-plus me-2"></i>Add New Goal';
        addButton.addEventListener('click', addNewGoal);
        
        // Add button to container
        buttonContainer.appendChild(addButton);
        
        // Insert before the table
        tableContainer.parentNode.insertBefore(buttonContainer, tableContainer);
    }
}

// Function to add a new goal
function addNewGoal() {
    // Generate a new goal ID (in a real app, this would come from the backend)
    const newId = currentGoalsData.length > 0 
        ? Math.max(...currentGoalsData.map(g => g.id)) + 1 
        : 1;
    
    // Create a new goal with default values
    const newGoal = {
        id: newId,
        name: `New Goal ${newId}`,
        description: "Description for this goal",
        priority: "Medium",
        assignees: ["Unassigned"],
        subtasks: [],
        dependencies: [],
        meeting_id: currentMeetingData.id  // Link to current meeting
    };
    
    // Add to the global goals array
    currentGoalsData.push(newGoal);
    
    // Re-render the goals table
    renderGoalsTable(currentGoalsData);
    
    // Scroll to the new goal and highlight it
    setTimeout(() => {
        const newGoalRow = document.querySelector(`.goal-row[data-goal-id="${newId}"]`);
        if (newGoalRow) {
            newGoalRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
            newGoalRow.classList.add('highlight-new');
            
            // Focus on the name field for immediate editing
            const nameCell = newGoalRow.querySelector('[data-field="name"]');
            if (nameCell) {
                nameCell.focus();
                
                // Select all text in the cell
                const selection = window.getSelection();
                const range = document.createRange();
                range.selectNodeContents(nameCell);
                selection.removeAllRanges();
                selection.addRange(range);
            }
            
            // Remove highlight after animation completes
            setTimeout(() => {
                newGoalRow.classList.remove('highlight-new');
            }, 3000);
        }
    }, 100);
    
    // Show confirmation
    showToast('New goal added! Edit the details and save.');
}
// Function to add a dependency to a goal
function addDependency(goalId, dependencyId) {
    // Find the goal in the data array
    const goal = currentGoalsData.find(g => g.id === goalId);
    
    if (!goal) {
        console.error(`Goal with ID ${goalId} not found`);
        showToast('Error: Goal not found');
        return;
    }
    
    // Initialize dependencies array if it doesn't exist
    if (!goal.dependencies) {
        goal.dependencies = [];
    }
    
    // Check if the dependency already exists
    if (goal.dependencies.includes(dependencyId)) {
        showToast('This dependency already exists');
        return;
    }
    
    // Check if this would create a circular dependency
    if (wouldCreateCircularDependency(goalId, dependencyId)) {
        showToast('Cannot add: This would create a circular dependency');
        return;
    }
    
    // Add the dependency
    goal.dependencies.push(dependencyId);
    
    // Show a confirmation message
    const dependencyGoal = currentGoalsData.find(g => g.id === dependencyId);
    showToast(`Added "${dependencyGoal.name}" as a dependency`);
    
    // Re-render the goals table and update visualization
    renderGoalsTable(currentGoalsData);
    refreshVisualization();
}

// Function to remove a dependency from a goal
function removeDependency(goalId, dependencyId) {
    // Find the goal in the data array
    const goal = currentGoalsData.find(g => g.id === goalId);
    
    if (!goal || !goal.dependencies) {
        console.error(`Goal with ID ${goalId} not found or has no dependencies`);
        showToast('Error: Goal or dependencies not found');
        return;
    }
    
    // Check if the dependency exists
    const index = goal.dependencies.indexOf(dependencyId);
    if (index === -1) {
        showToast('This dependency does not exist');
        return;
    }
    
    // Remove the dependency
    goal.dependencies.splice(index, 1);
    
    // Show a confirmation message
    const dependencyGoal = currentGoalsData.find(g => g.id === dependencyId);
    showToast(`Removed "${dependencyGoal.name}" as a dependency`);
    
    // Re-render the goals table and update visualization
    renderGoalsTable(currentGoalsData);
    refreshVisualization();
}

// Helper function to check if adding a dependency would create a circular reference
function wouldCreateCircularDependency(goalId, dependencyId) {
    // If we're trying to make a goal depend on itself, that's circular
    if (goalId === dependencyId) {
        return true;
    }
    
    // Check if the dependency already depends on this goal (directly or indirectly)
    const dependencyGoal = currentGoalsData.find(g => g.id === dependencyId);
    if (!dependencyGoal || !dependencyGoal.dependencies || dependencyGoal.dependencies.length === 0) {
        return false; // No dependencies, so no cycles
    }
    
    // Check if any of the dependency's dependencies would create a cycle
    const visited = new Set();
    const toCheck = [...dependencyGoal.dependencies];
    
    while (toCheck.length > 0) {
        const currentId = toCheck.pop();
        
        // If we've visited this node already, skip it
        if (visited.has(currentId)) {
            continue;
        }
        
        // Mark as visited
        visited.add(currentId);
        
        // If this is the original goal, we have a cycle
        if (currentId === goalId) {
            return true;
        }
        
        // Add this goal's dependencies to check
        const currentGoal = currentGoalsData.find(g => g.id === currentId);
        if (currentGoal && currentGoal.dependencies) {
            toCheck.push(...currentGoal.dependencies);
        }
    }
    
    return false;
}

// Save meeting changes
function saveMeetingChanges(row, meeting) {
    // Update the current meeting data
    currentMeetingData = meeting;
    
    // Show a success message
    showToast('Meeting information saved successfully!');
}

// Save goal changes
function saveGoalChanges(row, goal) {
    // Update the goal in the currentGoalsData array
    const index = currentGoalsData.findIndex(g => g.id === goal.id);
    if (index !== -1) {
        currentGoalsData[index] = goal;
    }
    
    // Show a success message
    showToast('Goal information saved successfully!');
}

// Function to remove a goal
function removeGoal(goalId) {
    // Find the index of the goal in the currentGoalsData array
    const index = currentGoalsData.findIndex(goal => goal.id === goalId);
    
    if (index !== -1) {
        // Get the goal's name for the confirmation message
        const goalName = currentGoalsData[index].name;
        
        // Ask for confirmation
        if (confirm(`Are you sure you want to delete the goal "${goalName}"?`)) {
            // Remove the goal from the array
            currentGoalsData.splice(index, 1);
            
            // Re-render the goals table
            renderGoalsTable(currentGoalsData);
            
            // Show a confirmation message
            showToast(`Goal "${goalName}" has been removed`);
            
            // Optionally, trigger a refresh of the visualization
            refreshVisualization();
        }
    } else {
        console.error(`Goal with ID ${goalId} not found`);
        showToast('Error: Goal not found');
    }
}
// Show a toast message
function showToast(message) {
    // Create toast element
    const toast = document.createElement('div');
    toast.className = 'toast-message';
    toast.textContent = message;
    
    // Append to body
    document.body.appendChild(toast);
    
    // Show and then hide after a delay
    setTimeout(() => {
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, 3000);
    }, 100);
}

// Fixed refresh visualization function and event binding

// Make sure initDataTables is called at the right time
function initDataTables() {
    console.log("Initializing data tables and controls");
    
    // Find the refresh button
    const refreshBtn = document.getElementById('refresh-viz-btn');
    
    if (refreshBtn) {
        console.log("Refresh button found, adding event listener");
        
        // Remove any existing event listeners to avoid duplicates
        refreshBtn.removeEventListener('click', refreshVisualization);
        
        // Add event listener for the refresh button
        refreshBtn.addEventListener('click', function() {
            console.log("Refresh button clicked");
            refreshVisualization();
        });
    } else {
        console.warn("Refresh button not found in the DOM yet");
    }
}

// Enhanced refresh visualization function with better error handling
// Enhanced refresh visualization function with better error handling
function refreshVisualization() {
    console.log("Refreshing visualization with data:", { 
        meeting: currentMeetingData, 
        goals: currentGoalsData 
    });
    
    try {
        // Make sure we have data to work with
        if (!currentMeetingData || !currentGoalsData || currentGoalsData.length === 0) {
            console.error("Cannot refresh - missing data");
            showToast('Error: Missing data for visualization');
            return;
        }
        
        // Update the meeting info display using global function references
        globalRenderMeetingInfo(currentMeetingData);
        
        // Clear and recreate the graph visualization
        document.getElementById('team-container').innerHTML = '';
        
        // Get all assignees from updated data using global function references
        const allAssignees = globalGetAllAssignees(currentGoalsData);
        
        // Render team members section with updated data
        globalRenderTeamMembers(allAssignees, currentGoalsData);
        
        // Destroy previous Cytoscape instance if it exists
        if (typeof cy !== 'undefined' && cy) {
            console.log("Destroying previous Cytoscape instance");
            cy.destroy();
        } else {
            console.warn("No existing Cytoscape instance found");
        }
        
        // Render knowledge graph with updated data
        globalRenderKnowledgeGraph(currentGoalsData, allAssignees);
        
        // Clear and render goals cards
        const goalsGrid = document.getElementById('goals-grid');
        goalsGrid.innerHTML = '';
        
        const goalsTableBody = document.getElementById('goals-table-body');
        goalsTableBody.innerHTML = '';
        
        // Render goals with updated data
        currentGoalsData.forEach(goal => {
            globalRenderGoalCard(goal, currentGoalsData);
            globalRenderGoalRow(goal, currentGoalsData);
        });
        
        // Initialize graph controls again
        globalInitGraphControls();
        
        // Show a success message
        showToast('Visualization refreshed with updated data!');
        console.log("Visualization refresh complete");
    } catch (error) {
        console.error("Error during visualization refresh:", error);
        showToast('Error refreshing visualization: ' + error.message);
    }
}

// Make sure event listeners are attached at the right time
document.addEventListener('DOMContentLoaded', function() {
    // This will be called once the DOM is fully loaded
    console.log("DOM loaded, initializing data tables");
    
    // Wait a short time for any dynamic elements to be added
    setTimeout(function() {
        initDataTables();
    }, 500);
});

// Modify the displayDataTables function to ensure initDataTables is called after rendering
function displayDataTables(meeting, goals) {
    console.log("Displaying data tables with:", { meeting, goals });
    
    // Store the current data globally
    currentMeetingData = meeting;
    currentGoalsData = goals;
    
    // Show the data editing section
    document.getElementById('data-editing-section').style.display = 'block';
    
    // Render meeting data
    renderMeetingTable(meeting);
    
    // Render goals data
    renderGoalsTable(goals);
    
    // Add the "Add Goal" button
    enhanceGoalsTableWithAddButton();
    
    // Initialize data tables controls AFTER rendering
    setTimeout(function() {
        initDataTables();
    }, 100);
}

// Add the CSS for the toast messages
document.addEventListener('DOMContentLoaded', function() {
    // Create a style element
    const style = document.createElement('style');
    style.textContent = `
        .toast-message {
            position: fixed;
            bottom: 20px;
            right: 20px;
            background-color: #28a745;
            color: white;
            padding: 10px 20px;
            border-radius: 4px;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
            z-index: 1000;
            opacity: 0;
            transform: translateY(20px);
            transition: opacity 0.3s, transform 0.3s;
        }
        
        .toast-message.show {
            opacity: 1;
            transform: translateY(0);
        }
    `;
    
    // Append to head
    document.head.appendChild(style);
    
    // Initialize data tables
    initDataTables();
});
// Add a dedicated button to show/hide the data editing section
const editButton = document.createElement('button');
editButton.id = 'edit-data-btn';
editButton.className = 'btn btn-primary ms-2';
editButton.innerHTML = '<i class="fas fa-edit me-1"></i>Review and Edit Data';
editButton.addEventListener('click', function() {
    const dataSection = document.getElementById('data-editing-section');
    if (dataSection.style.display === 'none') {
        dataSection.style.display = 'block';
        this.innerHTML = '<i class="fas fa-times me-1"></i>Hide Data Editor';
        
        // Scroll to the data section
        dataSection.scrollIntoView({ behavior: 'smooth' });
    } else {
        dataSection.style.display = 'none';
        this.innerHTML = '<i class="fas fa-edit me-1"></i>Review and Edit Data';
    }
});

// Add the button to the UI next to the toggle view button
document.addEventListener('DOMContentLoaded', function() {
    const toggleViewBtn = document.getElementById('toggle-view-btn');
    if (toggleViewBtn) {
        toggleViewBtn.parentNode.appendChild(editButton);
    }
});