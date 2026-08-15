const API_BASE_URL =
  import.meta.env.VITE_API_URL || "https://myfitday.onrender.com/api";

export function token() {
  return localStorage.getItem("myfitday_token");
}

function authHeaders() {
  const t = token();

  return {
    "Content-Type": "application/json",
    ...(t ? { Authorization: `Token ${t}` } : {}),
  };
}

async function request(path, options = {}) {
  const url = `${API_BASE_URL}${path}`;

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...authHeaders(),
        ...(options.headers || {}),
      },
    });

    const contentType = response.headers.get("content-type") || "";

    let data;

    if (contentType.includes("application/json")) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      const message =
        typeof data === "object"
          ? data.detail ||
            data.message ||
            Object.values(data).flat().join(" ")
          : data;

      throw new Error(message || `Request failed (${response.status})`);
    }

    return data;
  } catch (error) {
    console.error("API request failed:", {
      url,
      error,
    });

    if (error instanceof TypeError) {
      throw new Error(
        `Cannot connect to Django API at ${API_BASE_URL}. Make sure Django is running.`
      );
    }

    throw error;
  }
}


/* =========================
   AUTH
========================= */

export const api = {

  register: (payload) =>
    request("/auth/register/", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  login: (payload) =>
    request("/auth/login/", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  me: () =>
    request("/auth/me/"),

  logout: () => {
    localStorage.removeItem("myfitday_token");
    localStorage.removeItem("myfitday_user");
  },


  /* =========================
     WORKOUTS
  ========================= */

  workouts: () =>
    request("/workouts/"),

  workout: (id) =>
    request(`/workouts/${id}/`),

  createWorkout: (payload) =>
    request("/workouts/", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updateWorkout: (id, payload) =>
    request(`/workouts/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  deleteWorkout: (id) =>
    request(`/workouts/${id}/`, {
      method: "DELETE",
    }),


  /* =========================
     WORKOUT EXERCISES
  ========================= */

  addExercise: (workoutId, payload) =>
    request(`/workouts/${workoutId}/exercises/`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updateExercise: (workoutId, exerciseId, payload) =>
    request(`/workouts/${workoutId}/exercises/${exerciseId}/`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  deleteExercise: (workoutId, exerciseId) =>
    request(`/workouts/${workoutId}/exercises/${exerciseId}/`, {
      method: "DELETE",
    }),


  /* =========================
     SESSIONS
  ========================= */

  sessions: () =>
    request("/sessions/"),

  session: (id) =>
    request(`/sessions/${id}/`),

  createSession: (payload) =>
    request("/sessions/", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updateSession: (id, payload) =>
    request(`/sessions/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  deleteSession: (id) =>
    request(`/sessions/${id}/`, {
      method: "DELETE",
    }),


  /* =========================
     TODAY EXERCISE TOGGLE
  ========================= */

  toggleToday: (payload) =>
    request("/sessions/today/toggle/", {
      method: "POST",
      body: JSON.stringify(payload),
    }),


  /* =========================
     EXERCISE LOG
  ========================= */

  toggleExercise: (exerciseLogId, payload) =>
    request(`/exercise-logs/${exerciseLogId}/toggle/`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),


  /* =========================
     GOALS
  ========================= */

  goals: () =>
    request("/goals/"),

  saveGoal: (payload) =>
    request("/goals/", {
      method: "POST",
      body: JSON.stringify(payload),
    }),


  /* =========================
     SUMMARY
  ========================= */

  summary: () =>
    request("/summary/"),


  /* =========================
     EXERCISES
  ========================= */

  exercises: () =>
    request("/exercises/"),

  wger: (search = "") =>
    request(`/exercises/wger/?search=${encodeURIComponent(search)}`),


  /* =========================
     PHOTOS
  ========================= */

  photos: () =>
    request("/photos/"),

  uploadPhoto: async (file) => {
    const formData = new FormData();

    formData.append("image", file);

    const t = token();

    const response = await fetch(`${API_BASE_URL}/photos/`, {
      method: "POST",
      headers: {
        ...(t ? { Authorization: `Token ${t}` } : {}),
      },
      body: formData,
    });

    const contentType =
      response.headers.get("content-type") || "";

    const data = contentType.includes("application/json")
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      throw new Error(
        typeof data === "object"
          ? data.detail || "Photo upload failed"
          : data
      );
    }

    return data;
  },

  photoExportUrl: (range = "week") =>
    `${API_BASE_URL}/photos/export/?range=${range}`,

  photo: (id) =>
    request(`/photos/${id}/`),


  /* =========================
     AI COACH
  ========================= */

  coach: (prompt) =>
    request("/ai/coach/", {
      method: "POST",
      body: JSON.stringify({
        prompt,
      }),
    }),
};


/* =========================
   LOGOUT
========================= */

export function logout() {
  localStorage.removeItem("myfitday_token");
  localStorage.removeItem("myfitday_user");
}