// app.js - Complete Dashboard with Supabase Upload
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// ========== SUPABASE CONFIGURATION ==========
// REPLACE THESE WITH YOUR ACTUAL VALUES FROM SUPABASE
const SUPABASE_URL = 'https://dmrghgbbsvqlqmzuvbpb.supabase.co';  // Your Supabase URL
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtcmdoZ2Jic3ZxbHFtenV2YnBiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzYyNDUxNTgsImV4cCI6MjA1MTgyMTE1OH0.PGih7eEJ-Vf9XY47Ck9Moi3pSWerM6d61_JSPxImsIw';  // Your anon/public key

// Initialize Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
console.log('✅ Supabase initialized with URL:', SUPABASE_URL);

// ========== GLOBAL VARIABLES ==========
const TEAM_USERS = {
    "midhun": { password: "1977", role: "founder" },
    "akash": { password: "2024", role: "cofounder" },
    "sajad": { password: "5550", role: "marketing" },
    "saran": { password: "2244", role: "accountant" },
    "muhammad": { password: "1415", role: "social" }
};

let currentUser = null;
let currentTab = 'progress';
let hasShownAllTasksNotification = false;
let currentViewingMember = null;
let autoClearTimer = null;

// ========== DATA STORAGE ==========
let teamMembers = [];
let stockItems = [];
let progressLogs = [];
let qualityMetrics = {};
let farmSchedule = [];
let todoItems = [];
let teamPerformance = [];
let uploadedPhotos = []; // Local storage for backup

// ========== INITIALIZATION ==========
document.addEventListener('DOMContentLoaded', function() {
    console.log('Dashboard initializing...');
    loadAllData();
    showLoginScreen();
    
    if (localStorage.getItem('brokoons_auth') === 'true') {
        const savedUser = localStorage.getItem('brokoons_user');
        if (savedUser && TEAM_USERS[savedUser]) {
            currentUser = savedUser;
            showMainSystem();
        }
    }
    
    // Test Supabase connection on startup
    setTimeout(testSupabaseConnection, 1000);
});

// ========== SUPABASE FUNCTIONS ==========
async function testSupabaseConnection() {
    try {
        console.log('Testing Supabase connection...');
        
        // Test Storage
        const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
        console.log('Storage buckets:', buckets);
        
        // Test Database
        const { count, error: dbError } = await supabase
            .from('team_images')
            .select('*', { count: 'exact', head: true });
        console.log('Database connection test:', count, 'records found');
        
        if (bucketError) {
            console.error('Storage error:', bucketError);
            showNotification('⚠️ Storage Error', bucketError.message, 'warning', 5000);
        }
        if (dbError) {
            console.error('Database error:', dbError);
            showNotification('⚠️ Database Error', dbError.message, 'warning', 5000);
        }
        
        if (!bucketError && !dbError) {
            showNotification('✅ Supabase Connected', 'Storage and database are ready for uploads.', 'success', 3000);
        }
        
    } catch (error) {
        console.error('Supabase connection failed:', error);
        showNotification('⚠️ Supabase Offline', 'Using local storage for now.', 'warning', 5000);
    }
}

async function uploadPhotoToSupabase(file) {
    try {
        console.log('Starting Supabase upload for:', file.name);
        
        // Check file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            throw new Error('File size exceeds 5MB limit');
        }
        
        // Generate unique filename
        const fileName = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
        const filePath = `team-images/${fileName}`;
        
        // 1. Upload to Storage
        console.log('Uploading to storage...', filePath);
        const { data: storageData, error: storageError } = await supabase.storage
            .from('team-images')
            .upload(filePath, file);
        
        if (storageError) {
            console.error('Storage upload error:', storageError);
            throw new Error(`Storage error: ${storageError.message}`);
        }
        
        console.log('✅ Storage upload successful:', storageData);
        
        // 2. Get public URL
        const { data: { publicUrl } } = supabase.storage
            .from('team-images')
            .getPublicUrl(filePath);
        
        console.log('Public URL generated:', publicUrl);
        
        // 3. Save to Database
        const { data: dbData, error: dbError } = await supabase
            .from('team_images')
            .insert([
                {
                    image_url: publicUrl,
                    file_name: fileName,
                    original_name: file.name,
                    file_path: filePath,
                    uploaded_at: new Date().toISOString(),
                    file_size: file.size,
                    file_type: file.type,
                    uploaded_by: currentUser || 'unknown'
                }
            ]);
        
        if (dbError) {
            console.error('Database insert error:', dbError);
            throw new Error(`Database error: ${dbError.message}`);
        }
        
        console.log('✅ Database insert successful:', dbData);
        
        // Also save locally for backup
        const reader = new FileReader();
        reader.onload = function(e) {
            uploadedPhotos.unshift({
                id: Date.now(),
                name: file.name,
                data: e.target.result,
                date: getCurrentDate(),
                uploadedBy: currentUser,
                size: file.size,
                timestamp: Date.now(),
                supabase_url: publicUrl,
                supabase_path: filePath
            });
            saveAllData();
        };
        reader.readAsDataURL(file);
        
        showNotification('✅ Upload Successful', `${file.name} uploaded to Supabase!`, 'success', 4000);
        return { success: true, url: publicUrl, fileName: fileName, filePath: filePath };
        
    } catch (error) {
        console.error('Upload failed:', error);
        showNotification('❌ Upload Failed', error.message, 'error', 5000);
        return { success: false, error: error.message };
    }
}

async function loadImagesFromSupabase() {
    try {
        console.log('Loading images from Supabase...');
        
        const { data, error } = await supabase
            .from('team_images')
            .select('*')
            .order('uploaded_at', { ascending: false });
        
        if (error) throw error;
        
        console.log(`Loaded ${data?.length || 0} images from Supabase`);
        return data || [];
        
    } catch (error) {
        console.error('Error loading images from Supabase:', error);
        return [];
    }
}

async function deleteImageFromSupabase(imageId, filePath) {
    try {
        console.log('Deleting image from Supabase:', imageId, filePath);
        
        // 1. Delete from Storage
        const { error: storageError } = await supabase.storage
            .from('team-images')
            .remove([filePath]);
        
        if (storageError) throw storageError;
        
        // 2. Delete from Database
        const { error: dbError } = await supabase
            .from('team_images')
            .delete()
            .eq('id', imageId);
        
        if (dbError) throw dbError;
        
        console.log('✅ Image deleted from Supabase');
        return { success: true };
        
    } catch (error) {
        console.error('Error deleting image from Supabase:', error);
        return { success: false, error: error.message };
    }
}

// ========== UPDATED PHOTO UPLOAD HANDLER ==========
async function handlePhotoUpload(event) {
    const files = event.target.files;
    if (files.length === 0) return;
    
    const progressBar = document.getElementById('uploadProgressBar');
    const progressContainer = document.getElementById('uploadProgress');
    
    progressContainer.style.display = 'block';
    progressBar.style.width = '0%';
    
    let uploadedCount = 0;
    const totalFiles = files.length;
    
    // Process each file
    for (let i = 0; i < totalFiles; i++) {
        const file = files[i];
        
        // Update progress bar
        const currentProgress = Math.round(((i + 1) / totalFiles) * 100);
        progressBar.style.width = `${currentProgress}%`;
        
        // Upload to Supabase
        const result = await uploadPhotoToSupabase(file);
        if (result.success) {
            uploadedCount++;
        }
        
        // Small delay for UI updates
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Complete
    progressBar.style.width = '100%';
    
    setTimeout(() => {
        // Reload images from Supabase
        loadSupabaseImages();
        updatePhotoCount();
        
        showNotification(
            '📸 Upload Complete',
            `Successfully uploaded ${uploadedCount} photo${uploadedCount !== 1 ? 's' : ''} to Supabase!`,
            'photo',
            4000
        );
        
        setTimeout(() => {
            progressContainer.style.display = 'none';
            progressBar.style.width = '0%';
        }, 1000);
        
        event.target.value = '';
    }, 500);
}

// ========== LOAD SUPABASE IMAGES ==========
async function loadSupabaseImages() {
    const images = await loadImagesFromSupabase();
    
    const gallery = document.getElementById('photoGallery');
    if (!gallery) return;
    
    if (images.length === 0) {
        gallery.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #888;">
                <div style="font-size: 50px; margin-bottom: 15px;">📷</div>
                <p>No photos uploaded yet</p>
                <p style="font-size: 12px; margin-top: 10px;">Upload your first photo to Supabase!</p>
            </div>
        `;
        updatePhotoCount();
        return;
    }
    
    let html = '';
    images.forEach(photo => {
        const timeAgo = getTimeAgo(new Date(photo.uploaded_at).getTime());
        const fileSize = formatFileSize(photo.file_size);
        const displayName = photo.original_name || photo.file_name;
        
        html += `
            <div class="photo-item" onclick="previewSupabasePhoto('${photo.image_url}', '${displayName}')">
                <img src="${photo.image_url}" alt="${displayName}" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect width=%22100%22 height=%22100%22 fill=%22%23222%22/><text x=%2250%22 y=%2260%22 text-anchor=%22middle%22 fill=%22%234caf50%22 font-size=%2240%22>📷</text></svg>'">
                <div class="photo-actions">
                    <button class="btn btn-view" onclick="event.stopPropagation(); downloadFromUrl('${photo.image_url}', '${displayName}')" title="Download">⬇️</button>
                    <button class="btn btn-delete" onclick="event.stopPropagation(); deleteSupabasePhoto('${photo.id}', '${photo.file_path}')" title="Delete">🗑️</button>
                </div>
                <div class="photo-info">
                    <div class="photo-name" title="${displayName}">${displayName}</div>
                    <div class="photo-meta">
                        <span>${new Date(photo.uploaded_at).toLocaleDateString()}</span>
                        <span>${fileSize}</span>
                        <span>${timeAgo}</span>
                        <span>by ${photo.uploaded_by || 'unknown'}</span>
                    </div>
                </div>
            </div>
        `;
    });
    
    gallery.innerHTML = html;
    updatePhotoCount();
}

function previewSupabasePhoto(url, fileName) {
    const modal = document.getElementById('photoPreviewModal');
    const img = modal.querySelector('.photo-preview-img');
    const info = document.getElementById('photoPreviewInfo');
    
    img.src = url;
    img.alt = fileName;
    img.onerror = function() {
        this.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#222"/><text x="50" y="60" text-anchor="middle" fill="#4caf50" font-size="40">📷</text></svg>';
    };
    
    info.innerHTML = `
        <strong>${fileName}</strong><br>
        <small>Loaded from Supabase Storage</small>
    `;
    
    modal.style.display = 'flex';
}

async function deleteSupabasePhoto(imageId, filePath) {
    if (!confirm('Delete this image from Supabase?')) return;
    
    const result = await deleteImageFromSupabase(imageId, filePath);
    if (result.success) {
        showNotification('🗑️ Photo Deleted', 'Image removed from Supabase.', 'info', 3000);
        loadSupabaseImages();
    } else {
        showNotification('❌ Delete Failed', result.error, 'error', 5000);
    }
}

function downloadFromUrl(url, fileName) {
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showNotification('⬇️ Photo Downloaded', `${fileName} has been downloaded.`, 'info', 3000);
}

// ========== EXISTING DASHBOARD FUNCTIONS ==========
function login() {
    const username = document.getElementById('username').value.toLowerCase();
    const password = document.getElementById('password').value;
    
    if (TEAM_USERS[username] && TEAM_USERS[username].password === password) {
        localStorage.setItem('brokoons_auth', 'true');
        localStorage.setItem('brokoons_user', username);
        currentUser = username;
        
        showNotification('Login Successful', `Welcome back, ${username}!`, 'success', 3000);
        showMainSystem();
        
        const teamMember = teamMembers.find(member => 
            member.name.toLowerCase().includes(username)
        );
        if (teamMember) {
            teamMember.status = "online";
            teamMember.lastOnline = Date.now();
            saveAllData();
        }
        
        // Load Supabase images when logged in
        loadSupabaseImages();
    } else {
        document.getElementById('loginError').style.display = 'block';
    }
}

function logout() {
    if (currentUser) {
        const teamMember = teamMembers.find(member => 
            member.name.toLowerCase().includes(currentUser)
        );
        if (teamMember) {
            teamMember.status = "offline";
            teamMember.lastOnline = null;
        }
    }
    
    localStorage.removeItem('brokoons_auth');
    localStorage.removeItem('brokoons_user');
    currentUser = null;
    
    showNotification('Logged Out', 'You have been successfully logged out.', 'info', 3000);
    showLoginScreen();
}

function showLoginScreen() {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('mainContent').style.display = 'none';
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
    document.getElementById('loginError').style.display = 'none';
}

function showMainSystem() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('mainContent').style.display = 'block';
    document.getElementById('currentUser').textContent = currentUser;
    initializeDashboard();
}

function showTab(tabName) {
    currentTab = tabName;
    localStorage.setItem('brokoons_last_tab', tabName);
    
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
        tab.style.display = 'none';
    });
    
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    const selectedTab = document.getElementById(`${tabName}-tab`);
    selectedTab.classList.add('active');
    selectedTab.style.display = 'block';
    
    event.currentTarget.classList.add('active');
    
    if (tabName === 'dashboard') {
        updateStockTable();
        updateOnlineCount();
    } else if (tabName === 'stock') {
        updateInventoryTable();
    } else if (tabName === 'progress') {
        updateTodoList();
        updateFarmSchedule();
        updateProgressLog();
        updateQualityDisplay();
        updateTaskProgress();
        updatePhotoCount();
        // Load Supabase images when showing progress tab
        loadSupabaseImages();
    } else if (tabName === 'team') {
        updateTeamTable();
        updateTeamGraph();
    }
}

function initializeDashboard() {
    updateStockTable();
    updateInventoryTable();
    updateTeamTable();
    updateTodoList();
    updateFarmSchedule();
    updateProgressLog();
    updateQualityDisplay();
    updateTaskProgress();
    
    const savedTab = localStorage.getItem('brokoons_last_tab');
    showTab(savedTab || 'progress');
    
    const searchInput = document.getElementById('search-stock');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase();
            const rows = document.querySelectorAll('#inventory-table tr');
            
            rows.forEach(row => {
                const text = row.textContent.toLowerCase();
                row.style.display = text.includes(searchTerm) ? '' : 'none';
            });
        });
    }
    
    document.getElementById('current-date').textContent = `Today's Date: ${getCurrentDate()}`;
    
    document.getElementById('size-input').value = qualityMetrics.sizeRaw || 0;
    document.getElementById('color-input').value = qualityMetrics.colorRaw || 0;
    document.getElementById('growth-input').value = qualityMetrics.growthRaw || 0;
    document.getElementById('yield-input').value = qualityMetrics.yieldRaw || 0;
    document.getElementById('harvest-input').value = qualityMetrics.harvest || 0;
    
    calculateQuality();
}

// ========== UTILITY FUNCTIONS ==========
function getCurrentDate() {
    const now = new Date();
    return `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`;
}

function formatFileSize(bytes) {
    if (!bytes) return 'Unknown';
    if (bytes < 1024) return bytes + ' bytes';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / 1048576).toFixed(1) + ' MB';
}

function getTimeAgo(timestamp) {
    if (!timestamp) return 'Unknown';
    const now = Date.now();
    const diff = now - timestamp;
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
}

function showNotification(title, message, type = 'info', duration = 5000) {
    const container = document.getElementById('notificationContainer');
    const notificationId = 'notification-' + Date.now();
    
    let icon = 'ℹ️';
    let borderColor = '#2e7d32';
    
    switch(type) {
        case 'success': icon = '✅'; borderColor = '#4CAF50'; break;
        case 'warning': icon = '⚠️'; borderColor = '#FF9800'; break;
        case 'error': icon = '❌'; borderColor = '#F44336'; break;
        case 'tasks': icon = '🎯'; borderColor = '#2196F3'; break;
        case 'photo': icon = '📸'; borderColor = '#9C27B0'; break;
        case 'edit': icon = '✏️'; borderColor = '#FF9800'; break;
    }
    
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.id = notificationId;
    notification.style.borderColor = borderColor;
    
    notification.innerHTML = `
        <div class="notification-icon">${icon}</div>
        <div class="notification-content">
            <div class="notification-title">${title}</div>
            <div class="notification-message">${message}</div>
        </div>
        <button class="notification-close" onclick="removeNotification('${notificationId}')">×</button>
    `;
    
    container.appendChild(notification);
    
    setTimeout(() => {
        removeNotification(notificationId);
    }, duration);
    
    return notificationId;
}

function removeNotification(id) {
    const notification = document.getElementById(id);
    if (notification) {
        notification.style.animation = 'slideOut 0.3s forwards';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }
}

// ========== DATA LOAD/SAVE FUNCTIONS ==========
function loadAllData() {
    const savedTeam = localStorage.getItem('brokoons_team_members');
    if (savedTeam) {
        teamMembers = JSON.parse(savedTeam);
    } else {
        teamMembers = [
            { 
                name: "Midhun", 
                role: "Founder", 
                department: "Management", 
                details: "Overall management and strategy planning. 5+ years experience in mushroom farming.", 
                status: "online", 
                lastOnline: Date.now(),
                joinedDate: "01/01/2025",
                performance: "95%",
                photo: null
            },
            { 
                name: "Akash", 
                role: "Co-Founder", 
                department: "Operations", 
                details: "Handles day-to-day operations and farm management. Expert in organic farming techniques.", 
                status: "online", 
                lastOnline: Date.now(),
                joinedDate: "02/01/2025",
                performance: "92%",
                photo: null
            },
            { 
                name: "Mohammad Sajad", 
                role: "Marketing Head", 
                department: "Marketing", 
                details: "Marketing and sales strategy. Manages client relationships and market research.", 
                status: "online", 
                lastOnline: Date.now(),
                joinedDate: "20/01/2025",
                performance: "90%",
                photo: null
            },
            { 
                name: "Saran Kumar", 
                role: "Accountant", 
                department: "Finance", 
                details: "Financial management, budgeting, and accounts. Ensures financial compliance.", 
                status: "offline", 
                lastOnline: null,
                joinedDate: "5/02/2025",
                performance: "89%",
                photo: null
            },
            { 
                name: "Muhammad N", 
                role: "Social Media", 
                department: "Marketing", 
                details: "Social media management and digital presence. Creates content and engages with audience.", 
                status: "offline", 
                lastOnline: null,
                joinedDate: "06/02/2025",
                performance: "70%",
                photo: null
            }
        ];
    }
    
    // Load other data
    const savedStock = localStorage.getItem('brokoons_stock_items');
    stockItems = savedStock ? JSON.parse(savedStock) : [];
    
    const savedLogs = localStorage.getItem('brokoons_progress_logs');
    progressLogs = savedLogs ? JSON.parse(savedLogs) : [];
    
    const savedMetrics = localStorage.getItem('brokoons_quality_metrics');
    qualityMetrics = savedMetrics ? JSON.parse(savedMetrics) : {
        overall: 0,
        size: 0,
        color: 0,
        growth: 0,
        yield: 0,
        harvest: 0,
        lastUpdated: getCurrentDate()
    };
    
    const savedSchedule = localStorage.getItem('brokoons_farm_schedule');
    farmSchedule = savedSchedule ? JSON.parse(savedSchedule) : [
        { day: "Monday", tasks: ["Watering", "Temperature check", "Harvesting"] },
        { day: "Tuesday", tasks: ["Spore collection", "Cleaning", "Data recording"] },
        { day: "Wednesday", tasks: ["Watering", "Pest check", "Harvesting"] },
        { day: "Thursday", tasks: ["New batch setup", "Quality check"] },
        { day: "Friday", tasks: ["Watering", "Harvesting", "Weekly report"] }
    ];
    
    const savedTodos = localStorage.getItem('brokoons_todo_items');
    if (savedTodos) {
        todoItems = JSON.parse(savedTodos);
    } else {
        todoItems = [
            { id: 1, text: "Check mushroom growth progress", completed: false },
            { id: 2, text: "Record temperature and humidity", completed: false },
            { id: 3, text: "Water mushroom beds", completed: false },
            { id: 4, text: "Harvest mature mushrooms", completed: false },
            { id: 5, text: "Clean and sterilize equipment", completed: false }
        ];
    }
    
    const savedPhotos = localStorage.getItem('brokoons_photos');
    uploadedPhotos = savedPhotos ? JSON.parse(savedPhotos) : [];
    
    const savedPerformance = localStorage.getItem('brokoons_team_performance');
    if (savedPerformance) {
        teamPerformance = JSON.parse(savedPerformance);
    } else {
        teamPerformance = [
            { name: "Midhun", productivity: getRandomScore(), attendance: getRandomScore(), quality: getRandomScore(), color: "#4CAF50" },
            { name: "Akash", productivity: getRandomScore(), attendance: getRandomScore(), quality: getRandomScore(), color: "#2196F3" },
            { name: "Sajad", productivity: getRandomScore(), attendance: getRandomScore(), quality: getRandomScore(), color: "#FF9800" },
            { name: "Saran", productivity: getRandomScore(), attendance: getRandomScore(), quality: getRandomScore(), color: "#9C27B0" },
            { name: "Muhammad", productivity: getRandomScore(), attendance: getRandomScore(), quality: getRandomScore(), color: "#00BCD4" }
        ];
    }
}

function saveAllData() {
    localStorage.setItem('brokoons_team_members', JSON.stringify(teamMembers));
    localStorage.setItem('brokoons_stock_items', JSON.stringify(stockItems));
    localStorage.setItem('brokoons_progress_logs', JSON.stringify(progressLogs));
    localStorage.setItem('brokoons_quality_metrics', JSON.stringify(qualityMetrics));
    localStorage.setItem('brokoons_farm_schedule', JSON.stringify(farmSchedule));
    localStorage.setItem('brokoons_todo_items', JSON.stringify(todoItems));
    localStorage.setItem('brokoons_photos', JSON.stringify(uploadedPhotos));
    localStorage.setItem('brokoons_team_performance', JSON.stringify(teamPerformance));
}

function getRandomScore() {
    return Math.floor(Math.random() * 60) + 40;
}

function updatePhotoCount() {
    const photoCountElement = document.getElementById('photoCount');
    if (photoCountElement) {
        // We'll update this after loading from Supabase
        loadImagesFromSupabase().then(images => {
            photoCountElement.textContent = images.length;
        });
    }
}

// ========== MAKE FUNCTIONS GLOBALLY AVAILABLE ==========
window.login = login;
window.logout = logout;
window.showTab = showTab;
window.closePhotoPreview = function() {
    document.getElementById('photoPreviewModal').style.display = 'none';
};
window.closeMemberModal = function() {
    document.getElementById('memberModal').style.display = 'none';
    currentViewingMember = null;
};
window.handlePhotoUpload = handlePhotoUpload;
window.previewSupabasePhoto = previewSupabasePhoto;
window.deleteSupabasePhoto = deleteSupabasePhoto;
window.downloadFromUrl = downloadFromUrl;

// ========== EXPORT ALL REMAINING FUNCTIONS ==========
// Add all your existing functions here (addStockItem, updateTodoList, etc.)
// They should remain exactly as they were in your original code

console.log('✅ app.js fully loaded with Supabase integration!');
console.log('📊 Dashboard ready. Current user:', currentUser);
