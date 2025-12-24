package com.azzahra.sync;

import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ProgressBar;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseUser;
import com.google.firebase.firestore.DocumentSnapshot;
import com.google.firebase.firestore.FirebaseFirestore;

public class LoginActivity extends AppCompatActivity {

    private EditText etEmail, etPassword;
    private Button btnLogin;
    private ProgressBar loading;
    private FirebaseAuth mAuth;
    private FirebaseFirestore db;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_login);

        try {
            mAuth = FirebaseAuth.getInstance();
            db = FirebaseFirestore.getInstance();
        } catch (Exception e) {
            Toast.makeText(this, "Firebase Initialization Error", Toast.LENGTH_LONG).show();
        }

        etEmail = findViewById(R.id.etEmail);
        etPassword = findViewById(R.id.etPassword);
        btnLogin = findViewById(R.id.btnLogin);
        loading = findViewById(R.id.loading);

        // Cek login otomatis dengan delay agar stabil
        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            if (mAuth != null && mAuth.getCurrentUser() != null) {
                checkUserRoleAndNavigate(mAuth.getCurrentUser().getUid());
            }
        }, 500);

        btnLogin.setOnClickListener(v -> {
            String email = etEmail.getText().toString().trim();
            String pass = etPassword.getText().toString().trim();

            if (email.isEmpty() || pass.isEmpty()) {
                Toast.makeText(this, "Email dan Password wajib diisi", Toast.LENGTH_SHORT).show();
                return;
            }
            login(email, pass);
        });
    }

    private void login(String email, String password) {
        if (loading != null) loading.setVisibility(View.VISIBLE);
        if (btnLogin != null) btnLogin.setEnabled(false);

        mAuth.signInWithEmailAndPassword(email, password)
                .addOnCompleteListener(this, task -> {
                    if (task.isSuccessful()) {
                        FirebaseUser user = mAuth.getCurrentUser();
                        if (user != null) {
                            checkUserRoleAndNavigate(user.getUid());
                        }
                    } else {
                        if (loading != null) loading.setVisibility(View.GONE);
                        if (btnLogin != null) btnLogin.setEnabled(true);
                        String error = task.getException() != null ? task.getException().getMessage() : "Unknown Error";
                        Toast.makeText(this, "Login Gagal: " + error, Toast.LENGTH_LONG).show();
                    }
                });
    }

    private void checkUserRoleAndNavigate(String uid) {
        if (loading != null) loading.setVisibility(View.VISIBLE);
        if (btnLogin != null) btnLogin.setEnabled(false);

        db.collection("users").document(uid).get()
                .addOnCompleteListener(task -> {
                    if (loading != null) loading.setVisibility(View.GONE);
                    if (btnLogin != null) btnLogin.setEnabled(true);

                    if (task.isSuccessful() && task.getResult() != null) {
                        DocumentSnapshot doc = task.getResult();
                        if (doc.exists()) {
                            String role = doc.getString("role");
                            // HANYA ROLE OWNER YANG DIIZINKAN (ADMIN DIHAPUS)
                            if ("owner".equalsIgnoreCase(role)) {
                                Intent intent = new Intent(LoginActivity.this, MainActivity.class);
                                intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
                                startActivity(intent);
                                finish();
                            } else {
                                mAuth.signOut();
                                Toast.makeText(this, "Akses Ditolak: Hanya Owner yang diizinkan masuk", Toast.LENGTH_LONG).show();
                            }
                        } else {
                            mAuth.signOut();
                            Toast.makeText(this, "Data User tidak ditemukan", Toast.LENGTH_LONG).show();
                        }
                    } else {
                        mAuth.signOut();
                        String error = task.getException() != null ? task.getException().getMessage() : "Gagal cek Role";
                        Toast.makeText(this, "Error Database: " + error, Toast.LENGTH_LONG).show();
                    }
                });
    }
}
