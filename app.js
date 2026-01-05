// ======================
// 1. INITIALIZE SUPABASE (KEYS ALREADY SET)
// ======================
const supabaseUrl = 'https://upftnhuupcyjifgmfhnk.supabase.co';
const supabaseKey = 'sb_publishable_hKE3C6s7Y5aqyxW23wt_Bg_qjya_EdQ';
const supabase = supabase.createClient(supabaseUrl, supabaseKey);

// DOM Elements
const uploadBtn = document.getElementById('upload-btn');
const fileInput = document.getElementById('file-input');
const imageGrid = document.getElementById('image-grid');
const emptyState = document.getElementById('empty-state');

// ======================
// 2. LOAD TEAM IMAGES ON PAGE LOAD
// ======================
document.addEventListener('DOMContentLoaded', () => {
    loadTeamImages();
});

async function loadTeamImages() {
    const { data: images, error } = await supabase
        .from('team_images')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error loading images:', error);
        return;
    }

    if (images && images.length > 0) {
        emptyState.style.display = 'none';
        imageGrid.style.display = 'grid';
        renderImages(images);
    } else {
        emptyState.style.display = 'block';
        imageGrid.style.display = 'none';
    }
}

// ======================
// 3. HANDLE IMAGE UPLOAD
// ======================
uploadBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', handleImageUpload);

async function handleImageUpload(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    for (const file of files) {
        // Step 1: Upload file to Supabase Storage
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
        const { data: storageData, error: storageError } = await supabase.storage
            .from('team-images')
            .upload(fileName, file);

        if (storageError) {
            console.error('Storage upload error:', storageError);
            alert('Upload failed: ' + storageError.message);
            continue;
        }

        // Step 2: Get public URL of the uploaded file
        const { data: publicUrlData } = supabase.storage
            .from('team-images')
            .getPublicUrl(fileName);

        // Step 3: Save image info to Database
        const { error: dbError } = await supabase
            .from('team_images')
            .insert([
                {
                    image_url: publicUrlData.publicUrl,
                    uploaded_by: 'Midhun', // Change later for multi-user
                    title: file.name
                }
            ]);

        if (dbError) {
            console.error('Database insert error:', dbError);
        } else {
            console.log('Image saved to team database!');
        }
    }

    // Step 4: Reload images to show the new one
    fileInput.value = '';
    await loadTeamImages();
}

// ======================
// 4. RENDER IMAGES TO GRID
// ======================
function renderImages(images) {
    imageGrid.innerHTML = '';
    
    images.forEach(image => {
        const imageCard = document.createElement('div');
        imageCard.className = 'image-card';
        imageCard.innerHTML = `
            <img src="${image.image_url}" alt="${image.title}" loading="lazy">
            <div class="image-info">
                <h4>${image.title || 'Untitled'}</h4>
                <div class="image-stats">
                    <span>👤 ${image.uploaded_by || 'Anonymous'}</span>
                    <span>📅 ${new Date(image.created_at).toLocaleDateString()}</span>
                </div>
            </div>
        `;
        imageGrid.appendChild(imageCard);
    });
}

// ======================
// 5. TAB SWITCHING (Basic)
// ======================
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        // For now, just reload images for any tab
        loadTeamImages();
    });
});
