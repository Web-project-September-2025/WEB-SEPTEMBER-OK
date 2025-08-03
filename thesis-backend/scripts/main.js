document.getElementById("login-form").addEventListener("submit", function (e) {
    e.preventDefault();
  
    const role = document.getElementById("role").value;
  
    if (role === "student") {
      window.location.href = "student-dashboard.html";
    } else if (role === "professor") {
      window.location.href = "professor-dashboard.html";
    } else if (role === "secretary") {
      window.location.href = "secretary-dashboard.html";
    } else {
      alert("Παρακαλώ επιλέξτε ρόλο.");
    }
  });

  function logout() {
    window.location.href = "index.html";
  }
  
  function goToAddThesis() {
    window.location.href = "add-thesis.html";
  }
  
  function goBack() {
    window.history.back();
  }
    