// Simple test to verify validation system compiles
use std::process::Command;

fn main() {
    println!("Testing validation system compilation...");
    
    let output = Command::new("cargo")
        .args(&["check", "--bin", "gamestringer"])
        .current_dir("src-tauri")
        .output()
        .expect("Failed to execute cargo check");
    
    if output.status.success() {
        println!("✅ Validation system compiles successfully!");
    } else {
        println!("❌ Compilation errors:");
        println!("{}", String::from_utf8_lossy(&output.stderr));
    }
}