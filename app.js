// app.js - Complete Dashboard with Supabase Upload
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// ========== SUPABASE CONFIGURATION ==========
const SUPABASE_URL = 'https://dmrghgbbsvqlqmzuvbpb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtcmdoZ2Jic3ZxbHFtenV2YnBiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzYyNDUxNTgsImV4cCI6MjA1MTgyMTE1OH0.PGih7eEJ-Vf9XY47Ck9Moi3pSWerM6d61_JSPxImsIw';

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
let uploadedPhotos = [];

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
    
    setTimeout(testSupabaseConnection, 1000);
});

// ========== SUPABASE FUNCTIONS ==========
async function testSupabaseConnection() {
    try {
        console.log('Testing Supabase connection...');
        
        const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
        console.log('Storage buckets:', buckets);
        
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
        
        if (file.size > 5 * 1024 * 1024) {
            throw new Error('File size exceeds 5MB limit');
        }
        
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
        
        const { error: storageError } = await supabase.storage
            .from('team-images')
            .remove([filePath]);
        
        if (storageError) throw storageError;
        
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
    
    for (let i = 0; i < totalFiles; i++) {
        const file = files[i];
        const currentProgress = Math.round(((i + 1) / totalFiles) * 100);
        progressBar.style.width = `${currentProgress}%`;
        
        const result = await uploadPhotoToSupabase(file);
        if (result.success) uploadedCount++;
        
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    progressBar.style.width = '100%';
    
    setTimeout(() => {
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
    
    info.innerHTML = `<strong>${fileName}</strong><br><small>Loaded from Supabase Storage</small>`;
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

// ========== CORE DASHBOARD FUNCTIONS ==========
function login() {
    const username = document.getElementById('username').value.toLowerCase();
    const password = document.getElementById('password').value;
    
    if (TEAM_USERS[username] && TEAM_USERS[username].password === password) {
        localStorage.setItem('brokoons_auth', 'true');
        localStorage.setItem('brokoons_user', username);
        currentUser = username;
        
        showNotification('Login Successful', `Welcome back, ${username}!`, 'success', 3000);
        showMainSystem();
        
        const teamMember = teamMembers.find(member => member.name.toLowerCase().includes(username));
        if (teamMember) {
            teamMember.status = "online";
            teamMember.lastOnline = Date.now();
            saveAllData();
        }
        
        loadSupabaseImages();
    } else {
        document.getElementById('loginError').style.display = 'block';
    }
}

function logout() {
    if (currentUser) {
        const teamMember = teamMembers.find(member => member.name.toLowerCase().includes(currentUser));
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
                details: "Overall management and strategy planning.", 
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
                details: "Handles day-to-day operations.", 
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
                details: "Marketing and sales strategy.", 
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
                details: "Financial management.", 
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
                details: "Social media management.", 
                status: "offline", 
                lastOnline: null,
                joinedDate: "06/02/2025",
                performance: "70%",
                photo: null
            }
        ];
    }
    
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
        loadImagesFromSupabase().then(images => {
            photoCountElement.textContent = images.length;
        });
    }
}

// ========== MISSING DASHBOARD FUNCTIONS ==========
function updateStockTable() {
    const tbody = document.getElementById('stock-table-body');
    if (!tbody) return;
    
    let html = '';
    let totalStock = 0;
    
    stockItems.slice(0, 5).forEach(item => {
        totalStock += item.quantity || 0;
        const badgeClass = item.status === "In Stock" ? "badge-success" : 
                          item.status === "Low Stock" ? "badge-warning" : "badge-danger";
        
        html += `
            <tr>
                <td>${item.name || 'Unknown'}</td>
                <td>${item.quantity || 0}</td>
                <td><span class="badge ${badgeClass}">${item.status || 'Unknown'}</span></td>
                <td>${item.lastUpdated || 'Never'}</td>
                <td>
                    <button class="btn btn-edit" onclick="editItem('${item.name}')">Edit</button>
                    <button class="btn btn-delete" onclick="deleteItem('${item.name}')">Remove</button>
                </td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html || '<tr><td colspan="5" style="text-align: center; color: #888;">No stock items yet</td></tr>';
    
    const stockTotalElement = document.getElementById('stock-total');
    if (stockTotalElement) {
        stockTotalElement.textContent = totalStock;
    }
}

function updateInventoryTable() {
    const tbody = document.getElementById('inventory-table');
    if (!tbody) return;
    
    let html = '';
    let lowStockCount = 0;
    
    stockItems.forEach(item => {
        if (item.status === "Low Stock") lowStockCount++;
        const badgeClass = item.status === "In Stock" ? "badge-success" : 
                          item.status === "Low Stock" ? "badge-warning" : "badge-danger";
        
        html += `
            <tr>
                <td>${item.name || 'Unknown'}</td>
                <td>${item.category || 'Uncategorized'}</td>
                <td>${item.quantity || 0}</td>
                <td><span class="badge ${badgeClass}">${item.status || 'Unknown'}</span></td>
                <td>
                    <button class="btn btn-edit" onclick="editItem('${item.name}')">Edit</button>
                    <button class="btn btn-rename" onclick="renameItem('${item.name}')">Rename</button>
                    <button class="btn btn-delete" onclick="deleteItem('${item.name}')">Delete</button>
                </td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html || '<tr><td colspan="5" style="text-align: center; color: #888;">No inventory items yet</td></tr>';
    
    const lowStockElement = document.getElementById('low-stock-count');
    if (lowStockElement) {
        lowStockElement.textContent = `${lowStockCount} item${lowStockCount !== 1 ? 's' : ''} need${lowStockCount === 1 ? 's' : ''} attention`;
    }
}

function updateOnlineCount() {
    const onlineCount = teamMembers.filter(member => member.status === "online").length;
    const onlineElement = document.getElementById('online-count');
    if (onlineElement) {
        onlineElement.textContent = onlineCount;
    }
}

function updateTeamTable() {
    const tbody = document.getElementById('team-table');
    if (!tbody) return;
    
    let html = '';
    
    teamMembers.forEach(member => {
        const badgeClass = member.status === "online" ? "badge-success" : "badge-offline";
        const statusText = member.status === "online" ? "Online" : "Offline";
        const shortDetails = member.details && member.details.length > 50 ? 
            member.details.substring(0, 50) + "..." : 
            (member.details || "No details available");
        
        const showEditRemove = currentUser === 'midhun';
        
        html += `
            <tr>
                <td>${member.name || 'Unknown'}</td>
                <td>${member.role || 'Not specified'}</td>
                <td>${member.department || 'Not specified'}</td>
                <td>${shortDetails}</td>
                <td>
                    <span class="badge ${badgeClass}" onclick="toggleStatus('${member.name}')">
                        ${statusText}
                    </span>
                </td>
                <td>
                    <button class="btn btn-view" onclick="viewMemberDetails('${member.name}')">View</button>
                    ${showEditRemove ? `<button class="btn btn-edit" onclick="editTeamMember('${member.name}')">Edit</button>` : ''}
                    ${showEditRemove ? `<button class="btn btn-remove" onclick="removeTeamMember('${member.name}')">Remove</button>` : ''}
                </td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html || '<tr><td colspan="6" style="text-align: center; color: #888;">No team members yet</td></tr>';
    updateOnlineCount();
    
    const totalMembersElement = document.getElementById('total-members');
    if (totalMembersElement) {
        totalMembersElement.textContent = teamMembers.length;
    }
    
    const addMemberBtn = document.getElementById('addMemberBtn');
    if (addMemberBtn) {
        addMemberBtn.style.display = currentUser === 'midhun' ? 'block' : 'none';
    }
}

function updateTodoList() {
    const container = document.getElementById('todo-list-container');
    if (!container) return;
    
    let html = '';
    
    const sortedTasks = [...todoItems].sort((a, b) => {
        if (a.completed && !b.completed) return 1;
        if (!a.completed && b.completed) return -1;
        return 0;
    });
    
    sortedTasks.forEach(item => {
        html += `
            <div class="todo-item" data-id="${item.id}">
                <input type="checkbox" class="todo-checkbox" ${item.completed ? 'checked' : ''} onchange="updateTodo(${item.id}, this.checked)">
                <span class="todo-text ${item.completed ? 'todo-completed' : ''}">${item.text}</span>
                <div class="todo-actions">
                    <button class="btn btn-edit" onclick="editTodo(${item.id})">Edit</button>
                    <button class="btn btn-delete" onclick="removeTodo(${item.id})">Remove</button>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html || '<p style="color: #888; text-align: center;">No tasks yet. Add your first task!</p>';
    updateTaskProgress();
}

function updateTaskProgress() {
    const completedCount = todoItems.filter(t => t.completed).length;
    const totalCount = todoItems.length;
    const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
    
    const progressFill = document.getElementById('task-progress-fill');
    const progressText = document.getElementById('task-progress-text');
    
    if (progressFill) {
        progressFill.style.width = `${percentage}%`;
    }
    
    if (progressText) {
        progressText.textContent = `${completedCount}/${totalCount} (${percentage}%)`;
        
        if (percentage === 100) {
            progressText.style.color = '#4CAF50';
        } else if (percentage >= 50) {
            progressText.style.color = '#FF9800';
        } else {
            progressText.style.color = '#F44336';
        }
    }
}

function updateFarmSchedule() {
    const container = document.getElementById('farm-schedule-grid');
    if (!container) return;
    
    let html = '';
    
    farmSchedule.forEach(day => {
        html += `
            <div class="schedule-day">
                <h4>${day.day}</h4>
                ${day.tasks.map(task => `<p>• ${task}</p>`).join('')}
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function updateProgressLog() {
    const tbody = document.querySelector('#progress-log-table tbody');
    if (!tbody) return;
    
    let html = '';
    
    progressLogs.forEach(log => {
        const qualityScore = parseInt(log.quality) || 0;
        const badgeClass = qualityScore >= 90 ? "badge-success" : 
                         qualityScore >= 80 ? "badge-warning" : "badge-danger";
        
        html += `
            <tr>
                <td>${log.date || 'Unknown'}</td>
                <td>${log.batches || 0}</td>
                <td style="color: #4caf50;">${log.growth || '0%'}</td>
                <td>${log.yield || '0%'}</td>
                <td><span class="badge ${badgeClass}">${log.quality || '0/100'}</span></td>
                <td>
                    <button class="btn btn-edit" onclick="editProgressLog('${log.date}')">Edit</button>
                    <button class="btn btn-delete" onclick="deleteProgressLog('${log.date}')">Delete</button>
                </td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html || '<tr><td colspan="6" style="text-align: center; color: #888;">No progress logs yet</td></tr>';
}

function updateQualityDisplay() {
    const currentDateElement = document.getElementById('current-date');
    if (currentDateElement) {
        currentDateElement.textContent = `Today's Date: ${getCurrentDate()}`;
    }
    
    const qualityBar = document.getElementById('quality-bar');
    const qualityPercentage = document.getElementById('quality-percentage');
    const mainQualityScore = document.getElementById('main-quality-score');
    const qualityScoreValue = document.getElementById('quality-score-value');
    
    const overall = qualityMetrics.overall || 0;
    
    if (qualityBar) qualityBar.style.width = `${overall}%`;
    if (qualityPercentage) qualityPercentage.textContent = `${overall}%`;
    if (mainQualityScore) mainQualityScore.textContent = `${overall}/100`;
    if (qualityScoreValue) qualityScoreValue.textContent = `${overall}/100`;
}

function updateTeamGraph() {
    const graphContainer = document.getElementById('graphContainer');
    if (!graphContainer) return;
    
    graphContainer.innerHTML = '';
    
    teamPerformance.forEach(member => {
        const memberData = teamMembers.find(m => m.name === member.name);
        const isOnline = memberData && memberData.status === "online";
        
        const barHeight = Math.max(40, Math.min(100, member.productivity || 50));
        const bar = document.createElement('div');
        bar.className = 'graph-bar';
        bar.style.height = `${barHeight}%`;
        bar.style.background = member.color || '#4caf50';
        bar.style.opacity = isOnline ? '1' : '0.6';
        bar.style.transition = 'height 0.5s ease';
        
        bar.innerHTML = `
            <div class="graph-value">${barHeight}%</div>
            <div class="graph-label">${member.name}</div>
        `;
        
        graphContainer.appendChild(bar);
    });
}

function calculateQuality() {
    const sizeRaw = parseFloat(document.getElementById('size-input').value) || 0;
    const colorRaw = parseFloat(document.getElementById('color-input').value) || 0;
    const growthRaw = parseFloat(document.getElementById('growth-input').value) || 0;
    const yieldRaw = parseFloat(document.getElementById('yield-input').value) || 0;
    const harvest = parseFloat(document.getElementById('harvest-input').value) || 0;
    
    const sizePercent = Math.min(100, Math.round((sizeRaw / 30) * 100));
    const colorPercent = Math.min(100, Math.round((colorRaw / 10) * 100));
    const growthPercent = Math.min(100, Math.round(growthRaw));
    const yieldPercent = Math.min(100, Math.round((yieldRaw / 20) * 100));
    
    document.getElementById('size-display').textContent = `${sizePercent}/100`;
    document.getElementById('color-display').textContent = `${colorPercent}/100`;
    document.getElementById('growth-display').textContent = `${growthPercent}/100`;
    document.getElementById('yield-display').textContent = `${yieldPercent}/100`;
    document.getElementById('harvest-display').textContent = `${harvest} bags`;
    
    const overall = Math.round((sizePercent + colorPercent + growthPercent + yieldPercent) / 4);
    
    document.getElementById('quality-bar').style.width = `${overall}%`;
    document.getElementById('quality-percentage').textContent = `${overall}%`;
    document.getElementById('main-quality-score').textContent = `${overall}/100`;
    document.getElementById('quality-score-value').textContent = `${overall}/100`;
    
    qualityMetrics.sizeRaw = sizeRaw;
    qualityMetrics.colorRaw = colorRaw;
    qualityMetrics.growthRaw = growthRaw;
    qualityMetrics.yieldRaw = yieldRaw;
    qualityMetrics.harvest = harvest;
    
    qualityMetrics.size = sizePercent;
    qualityMetrics.color = colorPercent;
    qualityMetrics.growth = growthPercent;
    qualityMetrics.yield = yieldPercent;
    qualityMetrics.overall = overall;
}

// ========== ADDITIONAL DASHBOARD FUNCTIONS ==========
function addStockItem() {
    const name = prompt("Enter item name:");
    if (name) {
        const category = prompt("Enter category (Packaging/Supplies/Raw Materials/Equipment):");
        const quantity = parseInt(prompt("Enter quantity:")) || 0;
        
        if (name && category && !isNaN(quantity)) {
            const status = quantity > 30 ? "In Stock" : quantity > 10 ? "Low Stock" : "Out of Stock";
            stockItems.unshift({ 
                name, 
                category, 
                quantity, 
                status, 
                lastUpdated: "Just now" 
            });
            updateStockTable();
            updateInventoryTable();
            saveAllData();
            
            if (status === "Low Stock") {
                showNotification('⚠️ Low Stock Item Added', `${name} has been added with low stock (${quantity} remaining).`, 'warning', 5000);
            } else {
                showNotification('✅ Item Added', `${name} has been added to inventory.`, 'success', 3000);
            }
        }
    }
}

function editItem(itemName) {
    const item = stockItems.find(i => i.name === itemName);
    if (item) {
        const newQty = parseInt(prompt(`Edit quantity for ${itemName}:`, item.quantity)) || 0;
        if (!isNaN(newQty)) {
            item.quantity = newQty;
            item.status = newQty > 30 ? "In Stock" : newQty > 10 ? "Low Stock" : "Out of Stock";
            item.lastUpdated = "Just now";
            updateStockTable();
            updateInventoryTable();
            saveAllData();
            showNotification('✅ Item Updated', `${itemName} quantity updated to ${newQty}.`, 'success', 3000);
        }
    }
}

function renameItem(itemName) {
    const item = stockItems.find(i => i.name === itemName);
    if (item) {
        const newName = prompt(`Rename "${itemName}" to:`, item.name);
        if (newName && newName.trim() !== "") {
            item.name = newName;
            item.lastUpdated = "Just now";
            updateStockTable();
            updateInventoryTable();
            saveAllData();
            showNotification('✅ Item Renamed', `Item renamed to "${newName}".`, 'success', 3000);
        }
    }
}

function deleteItem(itemName) {
    if (confirm(`Delete "${itemName}" from inventory?`)) {
        stockItems = stockItems.filter(i => i.name !== itemName);
        updateStockTable();
        updateInventoryTable();
        saveAllData();
        showNotification('🗑️ Item Deleted', `${itemName} has been removed from inventory.`, 'info', 3000);
    }
}

function showLowStock() {
    const lowStockItems = stockItems.filter(item => item.status === "Low Stock");
    if (lowStockItems.length > 0) {
        let message = "Low Stock Items:\n\n";
        lowStockItems.forEach(item => {
            message += `• ${item.name}: ${item.quantity} remaining\n`;
        });
        alert(message);
    } else {
        alert("No low stock items!");
    }
}

function exportData() {
    alert("Exporting data...");
    showNotification('📊 Export Started', 'Data export process has started.', 'info', 3000);
}

function toggleStatus(memberName) {
    const member = teamMembers.find(m => m.name === memberName);
    if (!member) return;
    
    if (currentUser === 'midhun') {
        const wasOnline = member.status === "online";
        member.status = wasOnline ? "offline" : "online";
        if (member.status === "online") {
            member.lastOnline = Date.now();
            showNotification('👤 Member Online', `${memberName} is now online.`, 'success', 3000);
        } else {
            member.lastOnline = null;
            showNotification('👤 Member Offline', `${memberName} is now offline.`, 'info', 3000);
        }
        updateTeamTable();
        updateTeamGraph();
        saveAllData();
    } else {
        const userTeamMember = teamMembers.find(m => m.name.toLowerCase().includes(currentUser));
        if (userTeamMember && userTeamMember.name === memberName) {
            const wasOnline = member.status === "online";
            member.status = wasOnline ? "offline" : "online";
            if (member.status === "online") {
                member.lastOnline = Date.now();
                showNotification('👤 Status Changed', 'You are now online.', 'success', 3000);
            } else {
                member.lastOnline = null;
                showNotification('👤 Status Changed', 'You are now offline.', 'info', 3000);
            }
            updateTeamTable();
            updateTeamGraph();
            saveAllData();
        } else {
            showNotification('⛔ Access Denied', 'You can only change your own status.', 'error', 4000);
        }
    }
}

function editTeamMember(memberName) {
    if (currentUser !== 'midhun') {
        showNotification('⛔ Access Denied', 'Only Founder can edit team members.', 'error', 4000);
        return;
    }
    
    const member = teamMembers.find(m => m.name === memberName);
    if (member) {
        const newRole = prompt(`Edit role for ${memberName}:`, member.role);
        if (newRole) {
            const newDepartment = prompt(`Edit department for ${memberName}:`, member.department);
            const newDetails = prompt(`Edit details for ${memberName}:`, member.details);
            const newPerformance = prompt(`Edit performance for ${memberName} (0-100%):`, member.performance);
            
            if (newRole && newDepartment && newDetails && newPerformance) {
                member.role = newRole;
                member.department = newDepartment;
                member.details = newDetails;
                member.performance = newPerformance;
                updateTeamTable();
                saveAllData();
                showNotification('✅ Team Member Updated', `${memberName}'s details have been updated.`, 'success', 3000);
            }
        }
    }
}

function removeTeamMember(memberName) {
    if (currentUser !== 'midhun') {
        showNotification('⛔ Access Denied', 'Only Founder can remove team members.', 'error', 4000);
        return;
    }
    
    if (confirm(`Remove "${memberName}" from team?`)) {
        teamMembers = teamMembers.filter(m => m.name !== memberName);
        updateTeamTable();
        saveAllData();
        showNotification('👤 Team Member Removed', `${memberName} has been removed from the team.`, 'info', 3000);
    }
}

function addTeamMember() {
    if (currentUser !== 'midhun') {
        showNotification('⛔ Access Denied', 'Only Founder can add team members.', 'error', 4000);
        return;
    }
    
    const name = prompt("Enter team member name:");
    const role = prompt("Enter role:");
    const department = prompt("Enter department:");
    const details = prompt("Enter details (responsibilities, experience, etc.):");
    const performance = prompt("Enter performance (0-100%):", "85%");
    const joinedDate = prompt("Enter joined date (DD/MM/YYYY):", getCurrentDate());
    
    if (name && role && department && details && performance && joinedDate) {
        teamMembers.push({
            name,
            role,
            department,
            details,
            performance,
            joinedDate,
            status: "offline",
            lastOnline: null,
            photo: null
        });
        
        teamPerformance.push({
            name: name,
            productivity: parseInt(performance) || 85,
            attendance: 85,
            quality: 80,
            color: getRandomColor()
        });
        
        updateTeamTable();
        updateTeamGraph();
        saveAllData();
        showNotification('👤 Team Member Added', `${name} has been added to the team.`, 'success', 3000);
    }
}

function getRandomColor() {
    const colors = ['#4CAF50', '#2196F3', '#FF9800', '#9C27B0', '#00BCD4', '#FF5722', '#795548', '#607D8B'];
    return colors[Math.floor(Math.random() * colors.length)];
}

function viewMemberDetails(memberName) {
    const member = teamMembers.find(m => m.name === memberName);
    if (!member) return;
    
    currentViewingMember = member;
    
    document.getElementById('modalMemberName').textContent = member.name;
    document.getElementById('modalMemberRole').textContent = member.role;
    document.getElementById('modalMemberDepartment').textContent = member.department;
    document.getElementById('modalMemberStatus').textContent = member.status === "online" ? "🟢 Online" : "⚫ Offline";
    document.getElementById('modalMemberJoined').textContent = member.joinedDate || "Not specified";
    document.getElementById('modalMemberPerformance').textContent = member.performance || "Not rated";
    document.getElementById('modalMemberDetails').textContent = member.details || "No additional details available.";
    
    const photoElement = document.getElementById('modalMemberPhoto');
    if (member.photo) {
        photoElement.src = member.photo;
    } else {
        const initials = member.name.split(' ').map(n => n[0]).join('').toUpperCase();
        photoElement.src = `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#222"/><text x="50" y="60" text-anchor="middle" fill="#4caf50" font-size="40">${initials}</text></svg>`;
    }
    
    const uploadBtn = document.getElementById('uploadPhotoBtn');
    uploadBtn.style.display = currentUser === 'midhun' ? 'block' : 'none';
    
    document.getElementById('memberModal').style.display = 'flex';
}

function uploadMemberPhoto(event) {
    if (!currentViewingMember || currentUser !== 'midhun') return;
    
    const file = event.target.files[0];
    if (!file) return;
    
    if (file.size > 5 * 1024 * 1024) {
        alert(`File is too large (max 5MB)`);
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        currentViewingMember.photo = e.target.result;
        document.getElementById('modalMemberPhoto').src = e.target.result;
        updateTeamTable();
        saveAllData();
        showNotification('📸 Photo Uploaded', `${currentViewingMember.name}'s photo has been updated.`, 'success', 3000);
    };
    reader.readAsDataURL(file);
    event.target.value = '';
}

function showPerformance() {
    let message = "Team Performance:\n\n";
    teamPerformance.forEach(member => {
        const memberData = teamMembers.find(m => m.name === member.name);
        const status = memberData ? memberData.status : 'offline';
        message += `• ${member.name}: ${member.productivity || 0}% productivity (${status})\n`;
    });
    alert(message);
}

function editFarmSchedule() {
    const day = prompt("Enter day to edit (Monday-Friday):");
    if (day) {
        const scheduleDay = farmSchedule.find(d => d.day.toLowerCase() === day.toLowerCase());
        if (scheduleDay) {
            const newTasks = prompt(`Edit tasks for ${day} (separate with commas):`, scheduleDay.tasks.join(', '));
            if (newTasks) {
                scheduleDay.tasks = newTasks.split(',').map(t => t.trim()).filter(t => t !== '');
                updateFarmSchedule();
                saveAllData();
                showNotification('📅 Schedule Updated', `${day}'s schedule has been updated.`, 'success', 3000);
            }
        } else {
            alert("Day not found in schedule");
        }
    }
}

function showFarmSchedule() {
    let message = "Farm Schedule:\n\n";
    farmSchedule.forEach(day => {
        message += `${day.day}:\n`;
        day.tasks.forEach(task => {
            message += `  • ${task}\n`;
        });
        message += '\n';
    });
    alert(message);
}

function editProgressLog(date) {
    const log = progressLogs.find(l => l.date === date);
    if (log) {
        const newGrowth = prompt(`Edit growth for ${date}:`, log.growth);
        const newYield = prompt(`Edit yield for ${date}:`, log.yield);
        const newQuality = prompt(`Edit quality for ${date}:`, log.quality);
        
        if (newGrowth && newYield && newQuality) {
            log.growth = newGrowth;
            log.yield = newYield;
            log.quality = newQuality;
            updateProgressLog();
            saveAllData();
            showNotification('📝 Log Updated', `Progress log for ${date} has been updated.`, 'success', 3000);
        }
    }
}

function deleteProgressLog(date) {
    if (confirm(`Delete progress log for ${date}?`)) {
        progressLogs = progressLogs.filter(l => l.date !== date);
        updateProgressLog();
        saveAllData();
        showNotification('🗑️ Log Deleted', `Progress log for ${date} has been deleted.`, 'info', 3000);
    }
}

function addProgressLog() {
    const date = prompt("Enter date:", getCurrentDate());
    const batches = prompt("Enter number of batches:", "0");
    const growth = prompt("Enter growth rate:", "0%");
    const yield = prompt("Enter yield percentage:", "0%");
    const quality = prompt("Enter quality score:", "0/100");
    
    if (date && batches && growth && yield && quality) {
        progressLogs.unshift({
            date,
            batches: parseInt(batches) || 0,
            growth,
            yield,
            quality
        });
        updateProgressLog();
        saveAllData();
        showNotification('📊 Progress Log Added', 'New progress log has been added.', 'success', 3000);
    }
}

function saveQualityMetrics() {
    calculateQuality();
    qualityMetrics.lastUpdated = getCurrentDate();
    saveAllData();
    showNotification('⭐ Quality Metrics Saved', 'Your quality metrics have been saved successfully!', 'success', 3000);
}

function showDailyReport() {
    const completedCount = todoItems.filter(t => t.completed).length;
    const totalCount = todoItems.length;
    const harvest = qualityMetrics.harvest || 0;
    
    alert(`📅 Daily Report (${getCurrentDate()})\n\n• Tasks Completed: ${completedCount}/${totalCount}\n• Quality Score: ${qualityMetrics.overall || 0}/100\n• Growth Rate: ${qualityMetrics.growthRaw || 0}%\n• Harvested: ${harvest} bags\n\nCompleted Tasks:\n${todoItems.filter(t => t.completed).map(t => `✓ ${t.text}`).join('\n') || 'No tasks completed yet'}`);
}

function showQualityMetrics() {
    alert(`⭐ Quality Metrics (${getCurrentDate()})\n\n• Overall: ${qualityMetrics.overall || 0}/100\n• Size: ${qualityMetrics.size || 0}/100 (${qualityMetrics.sizeRaw || 0} cm)\n• Color: ${qualityMetrics.color || 0}/100 (${qualityMetrics.colorRaw || 0}/10)\n• Growth: ${qualityMetrics.growth || 0}/100 (${qualityMetrics.growthRaw || 0}%)\n• Yield: ${qualityMetrics.yield || 0}/100 (${qualityMetrics.yieldRaw || 0} kg)`);
}

function showTeamGraph() {
    if (currentUser === "midhun") {
        document.getElementById('teamGraph').style.display = 'block';
        updateTeamGraph();
    } else {
        showNotification('⛔ Access Denied', 'Only Founder can view team graph.', 'error', 4000);
    }
}

function updateTodo(id, completed) {
    const item = todoItems.find(t => t.id === id);
    if (item) {
        const wasCompleted = item.completed;
        item.completed = completed;
        saveAllData();
        updateTodoList();
        
        if (completed && !wasCompleted) {
            showNotification('✅ Task Completed!', `"${item.text}" has been marked as completed.`, 'success', 3000);
            const checkbox = document.querySelector(`[data-id="${id}"] .todo-checkbox`);
            if (checkbox) {
                checkbox.classList.add('reset-checkbox');
                setTimeout(() => checkbox.classList.remove('reset-checkbox'), 500);
            }
        } else if (!completed && wasCompleted) {
            showNotification('↩️ Task Reopened', `"${item.text}" has been reopened.`, 'info', 3000);
        }
        
        setTimeout(() => {
            const allCompleted = checkAllTasksCompleted();
            if (allCompleted) {
                startAutoResetTimer();
            }
        }, 500);
    }
}

function startAutoResetTimer() {
    if (autoClearTimer) {
        clearTimeout(autoClearTimer);
    }
    
    autoClearTimer = setTimeout(resetAllTasks, 3000);
    showNotification('🔄 Tasks Completed!', 'All tasks completed! Tasks will reset in 3 seconds...', 'success', 3000);
}

function resetAllTasks() {
    if (todoItems.length === 0) return;
    
    const checkboxes = document.querySelectorAll('.todo-checkbox:checked');
    checkboxes.forEach(checkbox => {
        checkbox.classList.add('reset-checkbox');
        checkbox.checked = false;
        
        const itemId = parseInt(checkbox.closest('.todo-item').dataset.id);
        const item = todoItems.find(t => t.id === itemId);
        if (item) {
            item.completed = false;
        }
    });
    
    saveAllData();
    updateTodoList();
    
    showNotification('🔄 Tasks Reset', `All ${todoItems.length} tasks have been reset to incomplete.`, 'info', 4000);
    
    hasShownAllTasksNotification = false;
    autoClearTimer = null;
}

function checkAllTasksCompleted() {
    if (todoItems.length === 0) return false;
    
    const completedCount = todoItems.filter(t => t.completed).length;
    const totalCount = todoItems.length;
    const percentage = Math.round((completedCount / totalCount) * 100);
    const allCompleted = completedCount === totalCount && totalCount > 0;
    
    updateTaskProgress();
    
    if (percentage === 50 && completedCount === totalCount / 2) {
        showNotification('🎯 Halfway There!', `You've completed ${completedCount}/${totalCount} tasks! Keep going!`, 'tasks', 4000);
    } else if (percentage === 75) {
        showNotification('🔥 Almost Done!', `You're at ${completedCount}/${totalCount} tasks! Just a few more!`, 'tasks', 4000);
    } else if (percentage === 100 && allCompleted && !hasShownAllTasksNotification) {
        createCelebrationEffect();
        hasShownAllTasksNotification = true;
        return true;
    }
    
    if (!allCompleted) {
        hasShownAllTasksNotification = false;
    }
    
    return allCompleted;
}

function createCelebrationEffect() {
    const celebration = document.createElement('div');
    celebration.style.position = 'fixed';
    celebration.style.top = '50%';
    celebration.style.left = '50%';
    celebration.style.transform = 'translate(-50%, -50%)';
    celebration.style.fontSize = '40px';
    celebration.style.fontWeight = 'bold';
    celebration.style.color = '#4CAF50';
    celebration.style.zIndex = '2000';
    celebration.style.opacity = '0';
    celebration.style.transition = 'opacity 1s';
    celebration.innerHTML = '🎉🎊 ALL TASKS DONE! 🎊🎉';
    document.body.appendChild(celebration);
    
    setTimeout(() => celebration.style.opacity = '1', 100);
    setTimeout(() => {
        celebration.style.opacity = '0';
        setTimeout(() => {
            if (celebration.parentNode) {
                celebration.parentNode.removeChild(celebration);
            }
        }, 1000);
    }, 2000);
}

function editTodo(id) {
    const item = todoItems.find(t => t.id === id);
    if (item) {
        const newText = prompt("Edit task:", item.text);
        if (newText && newText.trim() !== "") {
            const oldText = item.text;
            item.text = newText;
            updateTodoList();
            saveAllData();
            showNotification('✏️ Task Edited', `Task updated: "${newText}"`, 'edit', 3000);
        }
    }
}

function removeTodo(id) {
    const item = todoItems.find(t => t.id === id);
    if (item && confirm(`Remove "${item.text}" from task list?`)) {
        const removedText = item.text;
        todoItems = todoItems.filter(t => t.id !== id);
        updateTodoList();
        saveAllData();
        showNotification('🗑️ Task Removed', `"${removedText}" has been removed.`, 'info', 3000);
        hasShownAllTasksNotification = false;
    }
}

function addTodoItem() {
    const newTask = prompt("Enter new task:");
    if (newTask && newTask.trim() !== "") {
        const newId = todoItems.length > 0 ? Math.max(...todoItems.map(t => t.id)) + 1 : 1;
        todoItems.push({
            id: newId,
            text: newTask,
            completed: false
        });
        updateTodoList();
        saveAllData();
        showNotification('➕ New Task Added', `"${newTask}" has been added to your task list.`, 'success', 3000);
        hasShownAllTasksNotification = false;
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
window.addStockItem = addStockItem;
window.editItem = editItem;
window.renameItem = renameItem;
window.deleteItem = deleteItem;
window.showLowStock = showLowStock;
window.exportData = exportData;
window.toggleStatus = toggleStatus;
window.editTeamMember = editTeamMember;
window.removeTeamMember = removeTeamMember;
window.addTeamMember = addTeamMember;
window.viewMemberDetails = viewMemberDetails;
window.uploadMemberPhoto = uploadMemberPhoto;
window.showPerformance = showPerformance;
window.editFarmSchedule = editFarmSchedule;
window.showFarmSchedule = showFarmSchedule;
window.editProgressLog = editProgressLog;
window.deleteProgressLog = deleteProgressLog;
window.addProgressLog = addProgressLog;
window.saveQualityMetrics = saveQualityMetrics;
window.showDailyReport = showDailyReport;
window.showQualityMetrics = showQualityMetrics;
window.showTeamGraph = showTeamGraph;
window.updateTodo = updateTodo;
window.editTodo = editTodo;
window.removeTodo = removeTodo;
window.addTodoItem = addTodoItem;
window.calculateQuality = calculateQuality;

// ========== TEST FUNCTION ==========
async function testEverything() {
    console.log('🧪 Running comprehensive tests...');
    
    console.log('1. Testing Supabase connection...');
    const { data: user, error: userError } = await supabase.auth.getUser();
    console.log('Auth test:', user ? '✅ Connected' : '❌ Failed', userError);
    
    console.log('2. Testing storage bucket...');
    const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
    console.log('Buckets found:', buckets?.map(b => b.name));
    
    console.log('3. Testing database table...');
    const { data: images, error: dbError } = await supabase
        .from('team_images')
        .select('*')
        .limit(5);
    console.log('Table test:', images?.length || 0, 'records found');
    
    console.log('4. Testing upload capability...');
    const testFile = new File(['test'], 'test.txt', { type: 'text/plain' });
    const { data: uploadTest, error: uploadError } = await supabase.storage
        .from('team-images')
        .upload('test-file.txt', testFile);
    console.log('Upload test:', uploadTest ? '✅ Works' : '❌ Failed', uploadError);
    
    const success = !userError && !bucketError && !dbError;
    if (success) {
        showNotification('✅ All Tests Passed', 'Supabase connection is working perfectly!', 'success', 5000);
    } else {
        showNotification('⚠️ Some Tests Failed', 'Check console for details', 'warning', 5000);
    }
}

// Run test on page load
setTimeout(testEverything, 2000);

console.log('✅ app.js fully loaded with Supabase integration!');
console.log('📊 Dashboard ready. Current user:', currentUser);
// ADD THIS AT THE VERY END OF app.js
window.appAlreadyLoaded = true;
console.log("✅ app.js loaded successfully");
