// Group List Page Logic
let currentUser = null;
let currentCourse = null;
let groups = [];
let courseMembers = [];

document.addEventListener('DOMContentLoaded', async () => {
    // Check authentication
    await verifySession();
    
    // Load user data
    loadUserData();
    
    // Load groups
    await loadGroups();
    
    // Setup event listeners
    setupEventListeners();
});

async function verifySession() {
    try {
        const response = await fetch('/api/session/verify');
        if (!response.ok) {
            // Not logged in, redirect to login
            window.location.href = '/';
            return;
        }
    } catch (error) {
        console.error('Session verification error:', error);
        window.location.href = '/';
    }
}

function loadUserData() {
    const userData = sessionStorage.getItem('userData');
    if (userData) {
        const data = JSON.parse(userData);
        currentUser = data.user;
        currentCourse = data.course;
        
        // Update UI
        document.querySelector('.course-code').textContent = currentCourse.course_code;
        document.querySelector('.user-name').textContent = currentUser.full_name || currentUser.student_id;
        document.querySelector('.user-role').textContent = currentUser.role;
    }
}

async function loadGroups() {
    const groupListEl = document.getElementById('groupList');
    
    try {
        const response = await fetch('/api/groups');
        const data = await response.json();
        
        if (data.success) {
            groups = data.data;
            renderGroups(groups);
        } else {
            groupListEl.innerHTML = '<div class="loading">Failed to load groups</div>';
        }
    } catch (error) {
        console.error('Load groups error:', error);
        groupListEl.innerHTML = '<div class="loading">Error loading groups</div>';
    }
}

function renderGroups(groupList) {
    const groupListEl = document.getElementById('groupList');
    
    if (groupList.length === 0) {
        groupListEl.innerHTML = `
            <div class="loading">
                No groups yet. Create one to get started!
            </div>
        `;
        return;
    }
    
    groupListEl.innerHTML = groupList.map(group => `
        <div class="group-card" data-group-id="${group.id}">
            <div class="group-card-header">
                <h3 class="group-name">${escapeHtml(group.group_name)}</h3>
                <span class="member-count">${group.member_count || 0} members</span>
            </div>
            ${group.last_message ? `
                <div class="last-message">${escapeHtml(group.last_message)}</div>
                <div class="last-message-time">${formatDate(group.last_message_time)}</div>
            ` : `
                <div class="no-messages">No messages yet</div>
            `}
        </div>
    `).join('');
    
    // Add click listeners to group cards
    document.querySelectorAll('.group-card').forEach(card => {
        card.addEventListener('click', () => {
            const groupId = card.dataset.groupId;
            openChat(groupId);
        });
    });
}

function openChat(groupId) {
    // Navigate to chat page with group ID
    window.location.href = `/chat.html?groupId=${groupId}`;
}

function setupEventListeners() {
    // Logout button
    document.getElementById('logoutBtn').addEventListener('click', logout);
    
    // Create group button
    document.getElementById('createGroupBtn').addEventListener('click', openCreateGroupModal);
    
    // Toggle options menu
    document.getElementById('toggleOptionsBtn').addEventListener('click', toggleOptionsMenu);
    
    // Modal close buttons
    document.getElementById('closeCreateGroupModal').addEventListener('click', closeCreateGroupModal);
    document.getElementById('cancelCreateGroup').addEventListener('click', closeCreateGroupModal);
    
    // Create group form
    document.getElementById('createGroupForm').addEventListener('submit', handleCreateGroup);
    
    // Placeholder for other buttons
    document.getElementById('createBotBtn').addEventListener('click', openCreateBotModal);
    
    document.getElementById('uploadDocBtn').addEventListener('click', () => {
        alert('Document upload coming in Days 11-12!');
    });
    
    document.getElementById('vectorStoreBtn').addEventListener('click', () => {
        alert('Vector stores coming in Days 15-17!');
    });
}

async function logout() {
    try {
        await fetch('/api/session/end', { method: 'POST' });
        sessionStorage.clear();
        window.location.href = '/';
    } catch (error) {
        console.error('Logout error:', error);
        window.location.href = '/';
    }
}

function toggleOptionsMenu() {
    const menu = document.getElementById('optionsMenu');
    const btn = document.getElementById('toggleOptionsBtn');
    
    if (menu.style.display === 'none') {
        menu.style.display = 'flex';
        btn.textContent = 'Other Options ▲';
    } else {
        menu.style.display = 'none';
        btn.textContent = 'Other Options ▼';
    }
}

async function openCreateGroupModal() {
    const modal = document.getElementById('createGroupModal');
    modal.classList.add('active');
    
    // Load course members
    await loadCourseMembers();
}

function closeCreateGroupModal() {
    const modal = document.getElementById('createGroupModal');
    modal.classList.remove('active');
    
    // Reset form
    document.getElementById('createGroupForm').reset();
    document.getElementById('createGroupError').style.display = 'none';
}

async function loadCourseMembers() {
    const membersListEl = document.getElementById('membersList');
    
    try {
        const response = await fetch('/api/groups/course/members');
        const data = await response.json();
        
        if (data.success) {
            courseMembers = data.data;
            renderCourseMembers(courseMembers);
        } else {
            membersListEl.innerHTML = '<div class="loading-small">Failed to load members</div>';
        }
    } catch (error) {
        console.error('Load members error:', error);
        membersListEl.innerHTML = '<div class="loading-small">Error loading members</div>';
    }
}

function renderCourseMembers(members) {
    const membersListEl = document.getElementById('membersList');
    
    const filteredMembers = members.filter(m => m.id !== currentUser.id);
    
    if (filteredMembers.length === 0) {
        membersListEl.innerHTML = '<div class="loading-small">No other members in course</div>';
        return;
    }
    
    membersListEl.innerHTML = filteredMembers.map(member => `
        <label class="member-item">
            <input type="checkbox" name="members" value="${member.id}">
            <div class="member-info">
                <span class="member-name">${escapeHtml(member.full_name || member.student_id)}</span>
                <span class="member-email">${escapeHtml(member.email)}</span>
            </div>
        </label>
    `).join('');
}

async function handleCreateGroup(e) {
    e.preventDefault();
    
    const groupName = document.getElementById('groupName').value.trim();
    const selectedMembers = Array.from(document.querySelectorAll('input[name="members"]:checked'))
        .map(checkbox => parseInt(checkbox.value));
    
    if (!groupName) {
        showCreateGroupError('Group name is required');
        return;
    }
    
    // Show loading
    setCreateGroupLoading(true);
    hideCreateGroupError();
    
    try {
        const response = await fetch('/api/groups', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                group_name: groupName,
                members: selectedMembers
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Close modal
            closeCreateGroupModal();
            
            // Reload groups
            await loadGroups();
            
            // Show success (optional)
            alert('Group created successfully!');
        } else {
            showCreateGroupError(data.message || 'Failed to create group');
        }
    } catch (error) {
        console.error('Create group error:', error);
        showCreateGroupError('An error occurred. Please try again.');
    } finally {
        setCreateGroupLoading(false);
    }
}

function setCreateGroupLoading(loading) {
    const btn = document.getElementById('submitCreateGroup');
    const btnText = document.getElementById('createGroupBtnText');
    const btnLoader = document.getElementById('createGroupBtnLoader');
    
    if (loading) {
        btn.disabled = true;
        btnText.style.opacity = '0';
        btnLoader.style.display = 'block';
    } else {
        btn.disabled = false;
        btnText.style.opacity = '1';
        btnLoader.style.display = 'none';
    }
}

function showCreateGroupError(message) {
    const errorEl = document.getElementById('createGroupError');
    errorEl.textContent = message;
    errorEl.style.display = 'block';
}

function hideCreateGroupError() {
    document.getElementById('createGroupError').style.display = 'none';
}

// Utility functions
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateString) {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    
    // Less than 1 minute
    if (diff < 60000) {
        return 'Just now';
    }
    
    // Less than 1 hour
    if (diff < 3600000) {
        const minutes = Math.floor(diff / 60000);
        return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    }
    
    // Less than 24 hours
    if (diff < 86400000) {
        const hours = Math.floor(diff / 3600000);
        return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    }
    
    // Less than 7 days
    if (diff < 604800000) {
        const days = Math.floor(diff / 86400000);
        return `${days} day${days > 1 ? 's' : ''} ago`;
    }
    
    // Show actual date
    return date.toLocaleDateString();
}

// Bot creation functions
async function openCreateBotModal() {
    const modal = document.getElementById('createBotModal');
    if (modal) {
        modal.classList.add('active');
        await loadGroupsForBot();
    } else {
        alert('Bot creation modal not yet implemented. Feature coming soon!');
    }
}

async function loadGroupsForBot() {
    // This will be implemented when we add the modal
    console.log('Load groups for bot assignment');
}