// ================= BOOK SEAT MODAL =================
window.addEventListener("DOMContentLoaded", function () {

  const bookSeatBtn = document.getElementById("bookSeatBtn");
  const seatModal = document.getElementById("seatModal");
  const closeSeat = document.getElementById("closeSeat");

  if (bookSeatBtn) {
    bookSeatBtn.addEventListener("click", function () {
      seatModal.style.display = "flex";
    });
  }

  if (closeSeat) {
    closeSeat.addEventListener("click", function () {
      seatModal.style.display = "none";
    });
  }

});

// ================= BOOK SEAT FUNCTION =================
function bookSeat() {
  const name = document.getElementById("seatName").value.trim();
  const course = document.getElementById("seatCourse").value.trim();
  const id = document.getElementById("seatId").value.trim();
  const bus = document.getElementById("seatBus").value;

  if (!name || !course || !id || !bus) {
    alert("Please fill all fields!");
    return;
  }

  const key = "busSeats_" + bus;
  let data = JSON.parse(localStorage.getItem(key) || "[]");

  data.push({
    name: name,
    course: course,
    studentId: id,
    time: new Date().toLocaleString()
  });

  localStorage.setItem(key, JSON.stringify(data));

  alert("Seat booked successfully in Bus " + bus);

  document.getElementById("seatModal").style.display = "none";

  document.getElementById("seatName").value = "";
  document.getElementById("seatCourse").value = "";
  document.getElementById("seatId").value = "";
  document.getElementById("seatBus").value = "";
}
