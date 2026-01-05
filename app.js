// ======================
// 1. INITIALIZE SUPABASE WITH AUTH
// ======================
const supabaseUrl = 'https://upftnhuupcyjifgmfhnk.supabase.co';
const supabaseKey = 'sb_publishable_hKE3C6s7Y5aqyxW23wt_Bg_qjya_EdQ';

const supabase = supabase.createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

// DOM Elements
const uploadBtn = document.getElementById('upload-btn');
const fileInput = document.getElementById('file-input');
const imageGrid = document.getElementById('image-grid');
const emptyState = document.getElementById('empty-state');

// ======================
// DEBUG TEST: IS EVERYTHING CONNECTED?
// ======================
console.log('🔄 APP STARTING...');
console.log('Upload button found:', uploadBtn);
console.log('File input found:', fileInput);

// Test click event
uploadBtn.addEventListener('click', () => {
    console.log('✅ UPLOAD BUTTON CLICKED!');
});

// Test file input change
fileInput.addEventListener('change', (event) => {
    console.log('✅ FILE SELECTED:', event.target.files[0]?.name);
    handleImageUpload(event); // Manually trigger our function
});

// ======================
// 2. ANONYMOUS AUTHENTICATION (REQUIRED FOR UPLOADS)
// ======================
const authenticateApp = async () => {
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) {
    console.error('Auth error:', error);
  } else {
    console.log('App authenticated anonymously');
  }
};

// ======================
// 3. LOAD TEAM IMAGES ON PAGE LOAD
// ======================
document.addEventListener('DOMContentLoaded', () => {
  authenticateApp();
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
// 4. HANDLE IMAGE UPLOAD (DEBUG VERSION)
// ======================
async function handleImageUpload(event) {
  const files = event.target.files;
  if (!files || files.length === 0) return;
  
  console.log('=== UPLOAD DEBUG START ===');

  for (const file of files) {
    console.log('Processing file:', file.name, 'Size:', file.size, 'Type:', file.type);
    
    // Step 1: Upload file to Supabase Storage
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
    
    console.log('Generated filename:', fileName);
    
    try {
      console.log('Attempting storage upload...');
      const { data: storageData, error: storageError } = await supabase.storage
        .from('team-images')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (storageError) {
        console.error('❌ STORAGE UPLOAD FAILED:', storageError);
        console.error('Error code:', storageError.statusCode);
        console.error('Error message:', storageError.message);
        alert('Storage upload failed: ' + storageError.message);
        continue;
      }

      console.log('✅ STORAGE UPLOAD SUCCESS:', storageData);
      
      // Step 2: Get public URL
      const { data: publicUrlData } = supabase.storage
        .from('team-images')
        .getPublicUrl(fileName);
      
      console.log('Public URL:', publicUrlData.publicUrl);

      // Step 3: Save to database
      console.log('Saving to database...');
      const { error: dbError } = await supabase
        .from('team_images')
        .insert([
          {
            image_url: publicUrlData.publicUrl,
            uploaded_by: 'Team Member',
            title: file.name
          }
        ]);

      if (dbError) {
        console.error('❌ DATABASE SAVE FAILED:', dbError);
      } else {
        console.log('✅ Database save successful');
      }
      
    } catch (error) {
      console.error('❌ UNEXPECTED ERROR:', error);
    }
  }

  // Step 4: Reload images
  fileInput.value = '';
  console.log('=== UPLOAD DEBUG END ===');
  await loadTeamImages();
}

// ======================
// 5. RENDER IMAGES
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
// 6. TAB SWITCHING
// ======================
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    loadTeamImages();
  });
});
