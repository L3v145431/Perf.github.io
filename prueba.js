// Variables globales
let coursesCache = JSON.parse(localStorage.getItem('coursesCache')) || [];
let certificatesCache = [];
let usersCache = [];
let adminStatsCache = {};
let adminCertificatesCache = [];
let currentView = 'graduate';
let currentCourseId = null;
let currentImageFile = null;

// Función para guardar los cursos en localStorage
function saveCoursesToLocalStorage() {
  localStorage.setItem('coursesCache', JSON.stringify(coursesCache));
}

// Función para cargar los cursos desde localStorage
function loadCoursesFromLocalStorage() {
  const savedCourses = localStorage.getItem('coursesCache');
  if (savedCourses) {
    coursesCache = JSON.parse(savedCourses);
  }
}

// Función para generar un ID único
function generateUniqueId() {
  return 'WS-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
}

// Función para generar un hash
async function generateHash(input) {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

// Función para guardar información del certificado en Firestore
// Función para guardar información del certificado en Firestore
async function saveCertificateToFirestore(id, nombre, curso, fecha, hashHex) {
  try {
    // Obtener la fecha actual
    const fechaActual = new Date().toISOString().split('T')[0];

    await db.collection('certificates').add({
      id: id,
      nombre: nombre,
      curso: curso,
      fecha: fechaActual, // Utilizar la fecha actual
      hash: hashHex,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    console.log("Certificado guardado con éxito en Firestore");
  } catch (error) {
    console.error("Error al guardar el certificado en Firestore:", error);
    if (error.code === "permission-denied") {
      alert("No tienes permisos para guardar el certificado. Por favor, contacta al administrador.");
    } else {
      alert("Error al guardar el certificado. Por favor, inténtalo de nuevo más tarde.");
    }
  }
}


// Función para generar el enlace del código QR
function generateQRCodeLink(id) {
  return 'https://static.wixstatic.com/media/a687f1_d41ce5e63188472fbf07f5d14db3c63e~mv2.png';
}

async function generarPDFIndividual(nombre, curso, fecha, id, hashHex) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'A4' });
  const fondoURL = 'https://static.wixstatic.com/media/a687f1_6daa751a4aac4a418038ae37f20db004~mv2.jpg';

  const loadImage = (src) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  };

  try {
    const fondo = await loadImage(fondoURL);
    const qrUrl = generateQRCodeLink(id);
    const qrImage = await loadImage(qrUrl);

    doc.addImage(fondo, 'JPEG', 0, 0, 850, 595);
    doc.setFontSize(35);
    doc.setTextColor(0, 0, 0);
    doc.text(`${curso}`, 425, 130, { align: 'center' });
    doc.setTextColor(255, 255, 255);
    doc.text(`${nombre}`, 425, 190, { align: 'center' });
    doc.setTextColor(0, 0, 0);
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(14);

    const text = "weSpark hereby certifies that you have successfully completed our Design Sprint Masterclass, demonstrating your ability to lead teams to create and test new product concepts in only 4 days.";
    doc.text(doc.splitTextToSize(text, 600), 120, 250);

    const text1 = "This achievement signifies your initial step toward mastering the art of Sprinting. Continue to enhance your expertise by consistently applying the Sprint methodology to tackle real-world challenges and watch";
    doc.text(doc.splitTextToSize(text1, 650), 100, 310);
    doc.text("your skills evolve", 340, 345);

    doc.setFontSize(10);

    // Obtener la fecha actual
    const fechaActual = new Date().toLocaleDateString();

    doc.text(`Fecha: ${fechaActual}`, 128, 585);
    doc.text(`ID: ${id}`, 4, 15);
    doc.setFontSize(10);
    doc.text(`Hash: ${hashHex}`, 263, 585);
    doc.addImage(qrImage, 'PNG', 124, 460, 100, 100);

    // Devolver el PDF como un Blob
    return doc.output('blob');
  } catch (error) {
    console.error("Error al generar PDF:", error);
    alert(`⚠️ Error al generar el PDF para ${nombre}`);
    throw error;
  }
}


async function downloadCertificate(certificateId) {
  showLoading();
  try {
    const certificate = certificatesCache.find(cert => cert.id == certificateId);
    if (!certificate) throw new Error('Certificate not found');
    const id = generateUniqueId();
    const hashHex = await generateHash(id);
    const pdfBlob = await generarPDFIndividual(certificate.nombre, certificate.course.title, certificate.completionDate, id, hashHex);
    await saveCertificateToFirestore(id, certificate.nombre, certificate.course.title, certificate.completionDate, hashHex);

    // Crear un enlace para descargar el PDF
    const pdfUrl = URL.createObjectURL(pdfBlob);
    const a = document.createElement('a');
    a.href = pdfUrl;
    a.download = `certificado_${id}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    showToast('success', 'Certificate Downloaded', 'Your certificate has been downloaded successfully.');
  } catch (error) {
    console.error('Download error:', error);
    showToast('error', 'Download Failed', 'Failed to download certificate. Please try again.');
  } finally {
    hideLoading();
  }
}

function addCourse() {
  currentCourseId = null;
  currentImageFile = null;
  document.getElementById('course-form-title').textContent = 'Add Course';
  document.getElementById('course-form').reset();
  document.getElementById('course-image-preview').style.display = 'none';
  document.getElementById('course-form-container').classList.remove('hidden');
}

function editCourse(courseId) {
  const course = coursesCache.find(c => c.id === courseId);
  if (course) {
    currentCourseId = courseId;
    currentImageFile = null;
    document.getElementById('course-form-title').textContent = 'Edit Course';
    document.getElementById('course-title').value = course.title;
    document.getElementById('course-description').value = course.description;
    document.getElementById('course-duration').value = course.duration;
    document.getElementById('course-icon').value = course.icon;
    const savedImageUrl = localStorage.getItem(`courseImage_${courseId}`);
    if (savedImageUrl) {
      document.getElementById('course-image-preview').src = savedImageUrl;
      document.getElementById('course-image-preview').style.display = 'block';
    } else {
      document.getElementById('course-image-preview').style.display = 'none';
    }
    document.getElementById('course-form-container').classList.remove('hidden');
  }
}

document.getElementById('course-image').addEventListener('change', function(e) {
  const file = e.target.files[0];
  if (file) {
    currentImageFile = file;
    const reader = new FileReader();
    reader.onload = function(event) {
      document.getElementById('course-image-preview').src = event.target.result;
      document.getElementById('course-image-preview').style.display = 'block';
    };
    reader.readAsDataURL(file);
  }
});

async function uploadImage(file) {
  return new Promise((resolve) => {
    setTimeout(() => {
      const imageUrl = URL.createObjectURL(file);
      localStorage.setItem(`courseImage_${currentCourseId || 'new'}`, imageUrl);
      resolve(imageUrl);
    }, 1000);
  });
}

document.getElementById('course-form').addEventListener('submit', async function(e) {
  e.preventDefault();
  const title = document.getElementById('course-title').value;
  const description = document.getElementById('course-description').value;
  const duration = parseInt(document.getElementById('course-duration').value);
  const icon = document.getElementById('course-icon').value;
  let imageUrl = '';
  if (currentImageFile) {
    imageUrl = await uploadImage(currentImageFile);
  }
  if (currentCourseId) {
    coursesCache = coursesCache.map(c => {
      if (c.id === currentCourseId) {
        return { ...c, title, description, duration, icon, image: imageUrl || c.image };
      }
      return c;
    });
  } else {
    const newId = coursesCache.length > 0 ? Math.max(...coursesCache.map(c => c.id)) + 1 : 1;
    coursesCache.push({ id: newId, title, description, duration, icon, image: imageUrl });
  }
  saveCoursesToLocalStorage();
  displayCoursesTable();
  loadGraduateData();
  document.getElementById('course-form-container').classList.add('hidden');
});

function deleteCourse(courseId) {
  localStorage.removeItem(`courseImage_${courseId}`);
  coursesCache = coursesCache.filter(course => course.id !== courseId);
  saveCoursesToLocalStorage();
  displayCoursesTable();
}

document.addEventListener('DOMContentLoaded', function() {
  loadCoursesFromLocalStorage();
  initializeApp();
  setupEventListeners();
  loadInitialData();
});

function initializeApp() {
  setupNavigation();
  setupTabs();
  setupFileUpload();
  const urlParams = new URLSearchParams(window.location.search);
  const certificateId = urlParams.get('certificateId');
  if (certificateId) {
    showView('verifier');
    document.getElementById('certificate-id').value = certificateId;
    setTimeout(() => verifyCertificate(), 100);
  }
}

function setupEventListeners() {
  document.querySelectorAll('.nav-btn, .mobile-nav-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const view = e.target.dataset.view;
      if (view) showView(view);
    });
  });
  const certInput = document.getElementById('certificate-id');
  if (certInput) {
    certInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        verifyCertificate();
      }
    });
  }
  document.addEventListener('input', (e) => {
    if (e.target.id === 'users-search') {
      filterUsersTable(e.target.value);
    } else if (e.target.id === 'courses-search') {
      filterCoursesTable(e.target.value);
    } else if (e.target.id === 'certificates-search') {
      filterCertificatesTable(e.target.value);
    }
  });
}

function setupNavigation() {
  showView('graduate');
}

function showView(viewName) {
  currentView = viewName;
  document.querySelectorAll('.view').forEach(view => {
    view.classList.remove('active');
  });
  const targetView = document.getElementById(`${viewName}-view`);
  if (targetView) {
    targetView.classList.add('active');
  }
  document.querySelectorAll('.nav-btn, .mobile-nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === viewName);
  });
  loadViewData(viewName);
}

function loadViewData(viewName) {
  switch(viewName) {
    case 'graduate':
      loadGraduateData();
      break;
    case 'verifier':
      break;
    case 'admin':
      loadAdminData();
      break;
  }
}

function loadGraduateData() {
  showLoading();
  setTimeout(() => {
    const mockCertificates = coursesCache.map(course => ({
      id: course.id,
      nombre: 'John Doe',
      certificateId: `WS-2025-${course.id.toString().padStart(3, '0')}`,
      completionDate: '2023-01-15',
      course: course
    }));
    certificatesCache = mockCertificates;
    displayCertificates(mockCertificates);
    updateGraduateStats(mockCertificates);
    hideLoading();
  }, 500);
}

function displayCertificates(certificates) {
  const grid = document.getElementById('certificates-grid');
  if (!certificates || certificates.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 3rem;">
        <i class="fas fa-tag" style="font-size: 3rem; color: var(--neutral-400); margin-bottom: 1rem;"></i>
        <h3 style="color: var(--neutral-800); margin-bottom: 0.5rem;">No certificates yet</h3>
        <p style="color: var(--neutral-600);">Complete a course to earn your first certificate!</p>
      </div>
    `;
    return;
  }
  grid.innerHTML = certificates.map(cert => createCertificateCard(cert)).join('');
}
function createCertificateCard(certificate) {
  const completionDate = new Date(certificate.completionDate).toLocaleDateString();
  const courseIcon = certificate.course?.icon || 'fas fa-certificate';
  const courseThumbnail = certificate.course?.image;

  // Construye el enlace de LinkedIn con los parámetros adicionales
  const linkedInUrl = `https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME&name=${encodeURIComponent(certificate.course.title)}&organizationId=13993759&certificateUrl=${encodeURIComponent(window.location.href)}&certificateId=${encodeURIComponent(certificate.id)}`;

  return `
    <div class="certificate-card">
      ${courseThumbnail ? `
        <div class="certificate-thumbnail">
          <img src="${courseThumbnail}" alt="${certificate.course.title}" onerror="this.parentElement.style.display='none'">
        </div>
      ` : ''}
      <div class="certificate-body">
        <div class="certificate-header-content">
          <div class="certificate-icon-wrapper">
            <i class="${courseIcon}"></i>
          </div>
          <div class="badge">Completed</div>
        </div>
        <h3 class="certificate-title">${certificate.course.title}</h3>
        <p class="certificate-description">${certificate.course.description}</p>
        <div class="certificate-meta">
          <span>Completed: ${completionDate}</span>
          <span>${certificate.course.duration} hours</span>
        </div>
        <div class="certificate-actions">
          <button class="btn btn-primary" onclick="downloadCertificate(${certificate.id})">
            <i class="fas fa-download"></i>
            Download PDF
          </button>
          <a href="${linkedInUrl}" target="_blank" class="btn btn-linkedin">
            <i class="fab fa-linkedin"></i> Add to LinkedIn
          </a>
        </div>
      </div>
    </div>
  `;
}


function updateGraduateStats(certificates) {
  const totalCertificates = certificates?.length || 0;
  const totalHours = certificates?.reduce((sum, cert) => sum + cert.course.duration, 0) || 0;
  document.getElementById('total-certificates').textContent = totalCertificates;
  document.getElementById('total-hours').textContent = totalHours;
}

async function verifyCertificate() {
  const certificateInput = document.getElementById('certificate-id').value.trim();
  if (!certificateInput) {
    showToast('error', 'Certificate ID Required', 'Please enter a certificate ID or hash to verify.');
    return;
  }
  const btnText = document.querySelector('.verify-btn-text');
  const btnSpinner = document.querySelector('.verify-btn-spinner');
  btnText.classList.add('hidden');
  btnSpinner.classList.add('active');
  try {
    const certificatesRef = db.collection('certificates');
    const snapshotById = await certificatesRef.where('id', '==', certificateInput).get();
    const snapshotByHash = await certificatesRef.where('hash', '==', certificateInput).get();
    if (snapshotById.empty && snapshotByHash.empty) {
      displayVerificationError();
      showToast('error', 'Certificate Not Found', 'The certificate ID or hash was not found in our system.');
      return;
    }
    let certificateData;
    if (!snapshotById.empty) {
      snapshotById.forEach(doc => {
        certificateData = doc.data();
      });
    } else {
      snapshotByHash.forEach(doc => {
        certificateData = doc.data();
      });
    }
    displayVerificationResult(certificateData);
    showToast('success', 'Certificate Verified', 'This certificate is valid and authentic.');
  } catch (error) {
    console.error("Error verifying certificate: ", error);
    showToast('error', 'Verification Failed', 'An error occurred while verifying the certificate.');
  } finally {
    btnText.classList.remove('hidden');
    btnSpinner.classList.remove('active');
  }
}

function displayVerificationResult(certificate) {
  const resultContainer = document.getElementById('verification-result');
  const completionDate = certificate.fecha ? new Date(certificate.fecha).toLocaleDateString() : 'N/A';
  resultContainer.innerHTML = `
    <div class="verification-result">
      <div class="verification-success">
        <div class="verification-icon">
          <i class="fas fa-check-circle"></i>
        </div>
        <h2>Certificate Verified</h2>
        <p>This certificate is valid and authentic</p>
      </div>
      <div class="certificate-details">
        <div class="certificate-preview">
          <div class="certificate-preview-header">
            <div class="certificate-preview-user">
              <div class="certificate-preview-avatar">
                <i class="fas fa-graduation-cap"></i>
              </div>
              <div class="certificate-preview-info">
                <h3>${certificate.nombre || 'N/A'}</h3>
                <p>Certificate Holder</p>
              </div>
            </div>
          </div>
          <div class="certificate-data">
            <div class="data-row">
              <span class="data-label">Certificate ID</span>
              <span class="data-value">${certificate.id || 'N/A'}</span>
            </div>
            <div class="data-row">
              <span class="data-label">Course</span>
              <span class="data-value">${certificate.curso || 'N/A'}</span>
            </div>
            <div class="data-row">
              <span class="data-label">Completion Date</span>
              <span class="data-value">${completionDate}</span>
            </div>
            <div class="data-row">
              <span class="data-label">Status</span>
              <span class="data-value" style="color: var(--secondary-green);">
                <i class="fas fa-shield-alt"></i> Verified
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  resultContainer.classList.remove('hidden');
}

function displayVerificationError() {
  const resultContainer = document.getElementById('verification-result');
  resultContainer.innerHTML = `
    <div class="verification-result">
      <div class="verification-success">
        <div class="verification-icon" style="background-color: var(--destructive); background-opacity: 0.1;">
          <i class="fas fa-times-circle" style="color: var(--destructive);"></i>
        </div>
        <h2 style="color: var(--destructive);">Certificate Not Found</h2>
        <p>The certificate ID or hash was not found in our system. Please check the ID or hash and try again.</p>
      </div>
    </div>
  `;
  resultContainer.classList.remove('hidden');
}

function loadAdminData() {
  showLoading();
  setTimeout(() => {
    const mockStats = { totalUsers: 15, totalCourses: coursesCache.length, totalCertificates: 25 };
    adminStatsCache = mockStats;
    updateAdminStats(mockStats);
    const mockUsers = [
      { id: 1, name: 'John Doe', email: 'john.doe@example.com', role: 'admin', createdAt: '2023-01-15' },
      { id: 2, name: 'Jane Smith', email: 'jane.smith@example.com', role: 'graduate', createdAt: '2023-02-20' }
    ];
    usersCache = mockUsers;
    const mockCertificates = [
      { id: 1, certificateId: 'WS-2025-001', user: { name: 'John Doe' }, course: { title: 'Introduction to Web Development' }, completionDate: '2023-01-15' },
      { id: 2, certificateId: 'WS-2025-002', user: { name: 'Jane Smith' }, course: { title: 'Advanced JavaScript' }, completionDate: '2023-02-20' }
    ];
    adminCertificatesCache = mockCertificates;
    displayUsersTable();
    displayCoursesTable();
    displayAdminCertificatesTable();
    hideLoading();
  }, 500);
}

function updateAdminStats(stats) {
  document.getElementById('admin-total-users').textContent = stats.totalUsers || 0;
  document.getElementById('admin-total-courses').textContent = stats.totalCourses || 0;
  document.getElementById('admin-total-certificates').textContent = stats.totalCertificates || 0;
}

function setupTabs() {
  document.querySelectorAll('.tab-trigger').forEach(trigger => {
    trigger.addEventListener('click', (e) => {
      const tabName = e.target.dataset.tab;
      showTab(tabName);
    });
  });
}

function showTab(tabName) {
  document.querySelectorAll('.tab-trigger').forEach(trigger => {
    trigger.classList.toggle('active', trigger.dataset.tab === tabName);
  });
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.toggle('active', content.id === `${tabName}-tab`);
  });
  loadTabData(tabName);
}

function loadTabData(tabName) {
  switch(tabName) {
    case 'users':
      displayUsersTable();
      break;
    case 'courses':
      displayCoursesTable();
      break;
    case 'certificates':
      displayAdminCertificatesTable();
      break;
  }
}

function displayUsersTable() {
  const container = document.getElementById('users-table-container');
  const users = usersCache || [];
  if (users.length === 0) {
    container.innerHTML = `
      <div class="text-center" style="padding: 2rem;">
        <p>No users found.</p>
      </div>
    `;
    return;
  }
  container.innerHTML = `
    <div style="overflow-x: auto;">
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="border-bottom: 1px solid var(--neutral-200);">
            <th style="text-align: left; padding: 0.75rem; font-weight: 600;">Name</th>
            <th style="text-align: left; padding: 0.75rem; font-weight: 600;">Email</th>
            <th style="text-align: left; padding: 0.75rem; font-weight: 600;">Role</th>
            <th style="text-align: left; padding: 0.75rem; font-weight: 600;">Created</th>
            <th style="text-align: left; padding: 0.75rem; font-weight: 600;">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${users.map(user => `
            <tr style="border-bottom: 1px solid var(--neutral-200);">
              <td style="padding: 0.75rem;">${user.name}</td>
              <td style="padding: 0.75rem;">${user.email}</td>
              <td style="padding: 0.75rem;">
                <span class="badge" style="background-color: ${user.role === 'admin' ? 'var(--purple)' : 'var(--secondary-green)'}; color: white;">
                  ${user.role}
                </span>
              </td>
              <td style="padding: 0.75rem;">${new Date(user.createdAt).toLocaleDateString()}</td>
              <td style="padding: 0.75rem;">
                <button class="btn btn-outline" style="padding: 0.25rem 0.5rem; margin-right: 0.5rem;" onclick="alert('Edit functionality not implemented')">
                  <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-outline" style="padding: 0.25rem 0.5rem; color: var(--destructive); border-color: var(--destructive);" onclick="alert('Delete functionality not implemented')">
                  <i class="fas fa-trash"></i>
                </button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function setupFileUpload() {
  const uploadArea = document.getElementById('file-upload-area');
  const fileInput = document.getElementById('csv-file');
  const importBtn = document.getElementById('import-btn');
  if (!uploadArea || !fileInput) return;
  uploadArea.addEventListener('click', () => fileInput.click());
  uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.style.borderColor = 'var(--primary)';
  });
  uploadArea.addEventListener('dragleave', () => {
    uploadArea.style.borderColor = 'var(--neutral-200)';
  });
  uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.style.borderColor = 'var(--neutral-200)';
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type === 'text/csv') {
      handleFileSelection(files[0]);
    }
  });
  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleFileSelection(e.target.files[0]);
    }
  });
}

function handleFileSelection(file) {
  const fileInfo = document.getElementById('file-info');
  const fileName = document.getElementById('file-name');
  const uploadArea = document.getElementById('file-upload-area');
  const importBtn = document.getElementById('import-btn');
  fileName.textContent = file.name;
  uploadArea.style.display = 'none';
  fileInfo.classList.remove('hidden');
  importBtn.disabled = false;
}

function clearFile() {
  const fileInfo = document.getElementById('file-info');
  const uploadArea = document.getElementById('file-upload-area');
  const importBtn = document.getElementById('import-btn');
  const fileInput = document.getElementById('csv-file');
  fileInput.value = '';
  fileInfo.classList.add('hidden');
  uploadArea.style.display = 'block';
  importBtn.disabled = true;
}

async function importCsv() {
  const fileInput = document.getElementById('csv-file');
  const file = fileInput.files[0];

  if (!file) {
    showToast('error', 'No File Selected', 'Please select a CSV file to import.');
    return;
  }

  showLoading();

  try {
    const results = await new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        complete: resolve,
        error: reject
      });
    });

    const data = results.data;
    const zip = new JSZip();
    const defaultDate = '2025-07-01'; // Fecha por defecto

    for (const row of data) {
      let { nombre, curso, fecha } = row;

      // Asignar fecha por defecto si no se proporciona una fecha
      if (!fecha) {
        fecha = defaultDate;
        console.warn(`La fecha no estaba definida para ${nombre}, se asignó la fecha por defecto: ${defaultDate}`);
      }

      const id = generateUniqueId();
      const hashHex = await generateHash(id);

      // Generar el PDF del certificado y obtener el Blob
      const pdfBlob = await generarPDFIndividual(nombre, curso, fecha, id, hashHex);

      // Guardar el certificado en Firestore
      await saveCertificateToFirestore(id, nombre, curso, fecha, hashHex);

      // Agregar el PDF al ZIP
      zip.file(`certificado_${id}.pdf`, pdfBlob);
    }

    // Generar el archivo ZIP
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const zipUrl = URL.createObjectURL(zipBlob);

    // Descargar el archivo ZIP
    const a = document.createElement('a');
    a.href = zipUrl;
    a.download = 'certificados.zip';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    showToast('success', 'Certificates Generated', 'The certificates have been generated and downloaded successfully.');
  } catch (error) {
    console.error('Error importing CSV:', error);
    showToast('error', 'Import Failed', 'An error occurred while importing the CSV file.');
  } finally {
    hideLoading();
    clearFile();
  }
}

function showLoading() {
  document.getElementById('loading').classList.remove('hidden');
}

function hideLoading() {
  document.getElementById('loading').classList.add('hidden');
}

function showToast(type, title, description = '') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <div class="toast-header">
      <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
      <div class="toast-title">${title}</div>
    </div>
    ${description ? `<div class="toast-description">${description}</div>` : ''}
  `;
  container.appendChild(toast);
  setTimeout(() => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  }, 5000);
}

function loadInitialData() {
  loadGraduateData();
}

function displayCoursesTable() {
  const container = document.getElementById('courses-table-container');
  const courses = coursesCache || [];
  if (courses.length === 0) {
    container.innerHTML = `
      <div class="text-center" style="padding: 2rem;">
        <p>No courses found.</p>
      </div>
    `;
    return;
  }
  container.innerHTML = `
    <div style="overflow-x: auto;">
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="border-bottom: 1px solid var(--neutral-200);">
            <th style="text-align: left; padding: 0.75rem; font-weight: 600;">Title</th>
            <th style="text-align: left; padding: 0.75rem; font-weight: 600;">Description</th>
            <th style="text-align: left; padding: 0.75rem; font-weight: 600;">Duration</th>
            <th style="text-align: left; padding: 0.75rem; font-weight: 600;">Icon</th>
            <th style="text-align: left; padding: 0.75rem; font-weight: 600;">Image</th>
            <th style="text-align: left; padding: 0.75rem; font-weight: 600;">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${courses.map(course => {
            const savedImageUrl = localStorage.getItem(`courseImage_${course.id}`);
            return `
              <tr style="border-bottom: 1px solid var(--neutral-200);">
                <td style="padding: 0.75rem; font-weight: 600;">${course.title}</td>
                <td style="padding: 0.75rem; max-width: 300px;">${course.description}</td>
                <td style="padding: 0.75rem;">${course.duration} hours</td>
                <td style="padding: 0.75rem;">
                  <i class="${course.icon}" style="font-size: 1.25rem; color: var(--primary);"></i>
                </td>
                <td style="padding: 0.75rem;">
                  ${savedImageUrl ? `<img src="${savedImageUrl}" alt="${course.title}" style="width: 50px; height: auto;">` : 'No Image'}
                </td>
                <td style="padding: 0.75rem;">
                  <button class="btn btn-outline" style="padding: 0.25rem 0.5rem; margin-right: 0.5rem;" onclick="editCourse(${course.id})">
                    <i class="fas fa-edit"></i>
                  </button>
                  <button class="btn btn-outline" style="padding: 0.25rem 0.5rem; color: var(--destructive); border-color: var(--destructive);" onclick="deleteCourse(${course.id})">
                    <i class="fas fa-trash"></i>
                  </button>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function displayAdminCertificatesTable() {
  const container = document.getElementById('certificates-table-container');
  const certificates = adminCertificatesCache || [];
  if (certificates.length === 0) {
    container.innerHTML = `
      <div class="text-center" style="padding: 2rem;">
        <p>No certificates found.</p>
      </div>
    `;
    return;
  }
  container.innerHTML = `
    <div style="overflow-x: auto;">
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="border-bottom: 1px solid var(--neutral-200);">
            <th style="text-align: left; padding: 0.75rem; font-weight: 600;">Certificate ID</th>
            <th style="text-align: left; padding: 0.75rem; font-weight: 600;">Student</th>
            <th style="text-align: left; padding: 0.75rem; font-weight: 600;">Course</th>
            <th style="text-align: left; padding: 0.75rem; font-weight: 600;">Completion Date</th>
            <th style="text-align: left; padding: 0.75rem; font-weight: 600;">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${certificates.map(cert => `
            <tr style="border-bottom: 1px solid var(--neutral-200);">
              <td style="padding: 0.75rem; font-family: monospace; font-weight: 600;">${cert.certificateId}</td>
              <td style="padding: 0.75rem;">${cert.user.name}</td>
              <td style="padding: 0.75rem;">${cert.course.title}</td>
              <td style="padding: 0.75rem;">${new Date(cert.completionDate).toLocaleDateString()}</td>
              <td style="padding: 0.75rem;">
                <button class="btn btn-outline" style="padding: 0.25rem 0.5rem; margin-right: 0.5rem;" onclick="alert('Download functionality not implemented')">
                  <i class="fas fa-download"></i>
                </button>
                <button class="btn btn-outline" style="padding: 0.25rem 0.5rem;" onclick="alert('Verify functionality not implemented')">
                  <i class="fas fa-search"></i>
                </button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}
