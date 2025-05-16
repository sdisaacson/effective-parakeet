// Main JavaScript for the Action Item Extractor with Cytoscape.js graph visualization

document.addEventListener('DOMContentLoaded', function() {
    // Form submission handler
    const form = document.getElementById('transcript-form');
    const loadingIndicator = document.getElementById('loading');
    const resultsContainer = document.getElementById('results-container');
    const toggleViewBtn = document.getElementById('toggle-view-btn');
    const goalsGrid = document.getElementById('goals-grid');
    const listView = document.getElementById('list-view');
    const goalsTableBody = document.getElementById('goals-table-body');
    
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
                // Process and display the results with meeting info
                renderResults(data.goals, data.meeting);
                
                // Hide loading indicator, show results
                loadingIndicator.style.display = 'none';
                resultsContainer.style.display = 'block';
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