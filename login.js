// Configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyB43ne5sv_2-CzPC-GoNbBM5uNGiTHlQ0Q",
  authDomain: "users-ab3e0.firebaseapp.com",
  projectId: "users-ab3e0",
  storageBucket: "users-ab3e0.firebasestorage.app",
  messagingSenderId: "466535430209",
  appId: "1:466535430209:web:4e49fde0578fb037042ec0"
};

// Inicializar Firebase
const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore(); 

// Función para manejar el inicio de sesión
document.getElementById('login-form').addEventListener('submit', async function(e) {
  e.preventDefault();
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;

  // Configurar la persistencia de la sesión en Firebase
  auth.setPersistence(firebase.auth.Auth.Persistence.SESSION)
    .then(() => {
      // Iniciar sesión con el correo electrónico y la contraseña
   // Después de un login exitoso
return auth.signInWithEmailAndPassword(email, password);
})
.then(async (userCredential) => {
  const user = userCredential.user;
  // Obtener el documento del usuario en Firestore
  const userDoc = await db.collection('users').doc(user.uid).get();
  if (userDoc.exists) {
    const userData = userDoc.data();
    // Guardar nombre y rol en localStorage
    localStorage.setItem('userName', userData.name);
    localStorage.setItem('userRole', userData.role);
  }
  // Mostrar mensaje de éxito
  showToast('success', 'Login Successful', 'You have successfully logged in.');
  // Redirigir al usuario a la página principal
  setTimeout(() => {
    window.location.href = 'prueba.html';
  }, 2000);
})

    .catch((error) => {
      console.error("Error signing in: ", error);
      showToast('error', 'Login Failed', error.message);
    });
});



// En login.js
document.addEventListener('DOMContentLoaded', function() {
    const forgotPasswordLink = document.getElementById('forgot-password-link');
    const modal = document.getElementById('forgot-password-modal');
    const closeModal = document.querySelector('.close-modal');

    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', function(e) {
            e.preventDefault();
            modal.classList.remove('hidden');
        });
    }

    if (closeModal) {
        closeModal.addEventListener('click', function() {
            modal.classList.add('hidden');
        });
    }
});

// Función para enviar el correo de recuperación
function sendPasswordResetEmail() {
    const email = document.getElementById('recovery-email').value;
    if (!email) {
        showToast('error', 'Correo requerido', 'Por favor ingresa tu correo electrónico.');
        return;
    }

    auth.sendPasswordResetEmail(email)
        .then(() => {
            showToast('success', 'Correo enviado', 'Revisa tu bandeja de entrada para restablecer tu contraseña.');
            document.getElementById('forgot-password-modal').classList.add('hidden');
        })
        .catch((error) => {
            console.error("Error al enviar el correo de recuperación:", error);
            showToast('error', 'Error', error.message);
        });
}


// Función para mostrar mensajes toast
function showToast(type, title, description = '') {
  const container = document.getElementById('toast-container');
  if (!container) {
    console.error("Toast container not found");
    return;
  }

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
