// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
export const firebaseConfig = {
  apiKey: "AIzaSyBeLlbGi_qPlP2T47-zrsX3RORuHUFRfmw",
  authDomain: "quotation-management-sys-8dc4f.firebaseapp.com",
  projectId: "quotation-management-sys-8dc4f",
  storageBucket: "quotation-management-sys-8dc4f.firebasestorage.app",
  messagingSenderId: "596927535630",
  appId: "1:596927535630:web:f4882162369f645f90fa5f",
  measurementId: "G-VDHLQ7GBRC"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);
