import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { createRoot } from "react-dom/client";

import "./styles.css";

import {
  api,
  logout,
  token,
} from "./api";


// ============================================================
// CONSTANTS
// ============================================================

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const TAB_NAMES = [
  "Today",
  "Schedule",
  "Progress",
  "Photos",
  "AI Coach",
];

const TAB_ICONS = {
  Today: "⌂",
  Schedule: "▦",
  Progress: "◔",
  Photos: "▣",
  "AI Coach": "✦",
};


// ============================================================
// DATE HELPERS
// ============================================================

function dayNumber(day) {
  const index = DAYS.indexOf(day);

  return index >= 0 ? index + 1 : 1;
}


function todayName() {
  const dayIndex = new Date().getDay();

  return DAYS[(dayIndex + 6) % 7];
}


function weekDateForDay(day) {
  const now = new Date();

  const monday = new Date(now);

  monday.setHours(
    0,
    0,
    0,
    0
  );

  monday.setDate(
    now.getDate() -
      ((now.getDay() + 6) % 7)
  );

  const selectedDate = new Date(monday);

  selectedDate.setDate(
    monday.getDate() +
      DAYS.indexOf(day)
  );

  return selectedDate
    .toISOString()
    .slice(0, 10);
}


function formatDate(dateString) {
  if (!dateString) {
    return "";
  }

  return new Date(
    `${dateString}T00:00:00`
  ).toLocaleDateString(
    undefined,
    {
      month: "short",
      day: "numeric",
    }
  );
}


// ============================================================
// SAFE HELPERS
// ============================================================

function getExerciseName(exercise) {
  return (
    exercise?.exercise?.name ||
    exercise?.name ||
    "Exercise"
  );
}


function getExerciseCalories(exercise) {
  return Math.round(
    Number(exercise?.sets || 0) *
      Number(exercise?.reps || 0) *
      Number(exercise?.calories_per_set || 0.55)
  );
}


function calculateWorkoutCalories(workout) {
  return Math.round(
    (workout?.exercises || []).reduce(
      (total, exercise) =>
        total + getExerciseCalories(exercise),
      0
    )
  );
}


function calculateWorkoutProgress(
  workout,
  sessions
) {
  if (
    !workout ||
    !workout.exercises?.length
  ) {
    return 0;
  }

  const date = weekDateForDay(
    DAYS[(workout.day_of_week || 1) - 1]
  );

  const session = sessions.find(
    item =>
      Number(item.workout) ===
        Number(workout.id) &&
      item.date === date
  );

  const completedIds = new Set(
    (session?.logs || [])
      .filter(log => log.completed)
      .map(log =>
        Number(log.workout_exercise)
      )
  );

  const completed =
    workout.exercises.filter(
      exercise =>
        completedIds.has(
          Number(exercise.id)
        )
    ).length;

  return Math.round(
    (completed /
      workout.exercises.length) *
      100
  );
}


// ============================================================
// APP
// ============================================================

function App() {
  // ----------------------------------------------------------
  // AUTH
  // ----------------------------------------------------------

  const [
    user,
    setUser,
  ] = useState(() => {
    try {
      return JSON.parse(
        localStorage.getItem(
          "myfitday_user"
        ) || "null"
      );
    } catch {
      return null;
    }
  });


  // ----------------------------------------------------------
  // UI STATE
  // ----------------------------------------------------------

  const [
    tab,
    setTab,
  ] = useState("Today");

  const [
    day,
    setDay,
  ] = useState(todayName());

  const [
    theme,
    setTheme,
  ] = useState(
    () =>
      localStorage.getItem(
        "myfitday_theme"
      ) || "dark"
  );


  // ----------------------------------------------------------
  // APPLICATION DATA
  // ----------------------------------------------------------

  const [
    workouts,
    setWorkouts,
  ] = useState([]);

  const [
    summary,
    setSummary,
  ] = useState(null);

  const [
    goal,
    setGoal,
  ] = useState(2500);

  const [
    photos,
    setPhotos,
  ] = useState([]);

  const [
    sessions,
    setSessions,
  ] = useState([]);


  // ----------------------------------------------------------
  // UI / ACTION STATE
  // ----------------------------------------------------------

  const [
    modal,
    setModal,
  ] = useState(null);

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    toast,
    setToast,
  ] = useState("");

  const [coachMessages, setCoachMessages] = useState([
  {
    role: "assistant",
    content:
      "Hi! I'm your MyFiTDay AI Coach. Ask me anything about workouts, exercises, training, recovery, or your progress.",
  },
]);

  const [
    actionLoading,
    setActionLoading,
  ] = useState(false);


  // ==========================================================
  // DERIVED DATA
  // ==========================================================

  const selectedWorkout = useMemo(
    () =>
      workouts.find(
        workout =>
          Number(workout.day_of_week) ===
          dayNumber(day)
      ) || null,
    [workouts, day]
  );


  const selectedDate = useMemo(
    () =>
      weekDateForDay(day),
    [day]
  );


  const selectedSession = useMemo(
    () =>
      sessions.find(
        session =>
          Number(session.workout) ===
            Number(selectedWorkout?.id) &&
          session.date === selectedDate
      ) || null,
    [
      sessions,
      selectedWorkout,
      selectedDate,
    ]
  );


  const completedIds = useMemo(
    () =>
      new Set(
        (selectedSession?.logs || [])
          .filter(log => log.completed)
          .map(log =>
            Number(
              log.workout_exercise
            )
          )
      ),
    [selectedSession]
  );


  const currentProgress = useMemo(() => {
    if (
      !selectedWorkout?.exercises?.length
    ) {
      return 0;
    }

    const completed =
      selectedWorkout.exercises.filter(
        exercise =>
          completedIds.has(
            Number(exercise.id)
          )
      ).length;

    return Math.round(
      (completed /
        selectedWorkout.exercises.length) *
        100
    );
  }, [
    selectedWorkout,
    completedIds,
  ]);


  const weeklyProgress = useMemo(() => {
    const totalCalories =
      Number(
        summary?.total_calories || 0
      );

    const weeklyGoal =
      Number(goal || 2500);

    if (weeklyGoal <= 0) {
      return 0;
    }

    return Math.min(
      100,
      Math.round(
        (totalCalories /
          weeklyGoal) *
          100
      )
    );
  }, [
    summary,
    goal,
  ]);


  // ==========================================================
  // THEME
  // ==========================================================

  useEffect(() => {
    document.documentElement.dataset.theme =
      theme;

    localStorage.setItem(
      "myfitday_theme",
      theme
    );
  }, [theme]);


  // ==========================================================
  // TOAST AUTO CLEAR
  // ==========================================================

  useEffect(() => {
    if (!toast) {
      return undefined;
    }

    const timer = setTimeout(
      () => setToast(""),
      3000
    );

    return () =>
      clearTimeout(timer);
  }, [toast]);


  // ==========================================================
  // REFRESH APPLICATION DATA
  // ==========================================================

  const refresh = useCallback(
    async () => {
      if (!user || !token()) {
        return;
      }

      setLoading(true);

      try {
        const [
          workoutData,
          summaryData,
          goalData,
          photoData,
          sessionData,
        ] = await Promise.all([
          api.workouts(),
          api.summary(),
          api.goals(),
          api.photos(),
          api.sessions(),
        ]);

        setWorkouts(
          Array.isArray(workoutData)
            ? workoutData
            : []
        );

        setSummary(
          summaryData || null
        );

        setGoal(
          Number(
            goalData?.[0]
              ?.weekly_calorie_target ||
              2500
          )
        );

        setPhotos(
          Array.isArray(photoData)
            ? photoData
            : []
        );

        setSessions(
          Array.isArray(sessionData)
            ? sessionData
            : []
        );

      } catch (error) {
        setToast(
          error?.message ||
            "Unable to sync application data."
        );

      } finally {
        setLoading(false);
      }
    },
    [user]
  );


  // ==========================================================
  // INITIAL DATA LOAD
  // ==========================================================

  useEffect(() => {
    if (!user || !token()) {
      return;
    }

    refresh();
  }, [
    user,
    refresh,
  ]);


  // ==========================================================
  // AUTH
  // ==========================================================

  function handleAuth(nextUser) {
    setUser(nextUser);
    setTab("Today");
    setDay(todayName());
  }


  function signOut() {
    logout();

    setUser(null);

    setWorkouts([]);
    setSummary(null);
    setGoal(2500);
    setPhotos([]);
    setSessions([]);

    setCoachMessages([
      {
        role: "assistant",
        content:
          "Hi! I'm your MyFiTDay AI Coach. Ask me anything about workouts, exercises, training, recovery, or your progress.",
      },
    ]);

    setTab("Today");
  }


  // ==========================================================
  // WORKOUT ACTIONS
  // ==========================================================

  async function toggleExercise(
    exercise
  ) {
    if (
      !exercise?.id ||
      actionLoading
    ) {
      return;
    }

    setActionLoading(true);

    try {
      await api.toggleToday({
        workout_exercise_id:
          exercise.id,

        completed:
          !completedIds.has(
            Number(exercise.id)
          ),

        date: selectedDate,
      });

      await refresh();

    } catch (error) {
      setToast(
        error?.message ||
          "Unable to update exercise."
      );

    } finally {
      setActionLoading(false);
    }
  }


  // ==========================================================
  // GOAL
  // ==========================================================

  async function saveGoal() {
    const numericGoal =
      Number(goal);

    if (
      !Number.isFinite(
        numericGoal
      ) ||
      numericGoal <= 0
    ) {
      setToast(
        "Please enter a valid weekly calorie goal."
      );

      return;
    }

    setActionLoading(true);

    try {
      await api.saveGoal({
        weekly_calorie_target:
          numericGoal,
      });

      setModal(null);

      setToast(
        "Weekly goal saved successfully."
      );

      await refresh();

    } catch (error) {
      setToast(
        error?.message ||
          "Unable to save weekly goal."
      );

    } finally {
      setActionLoading(false);
    }
  }


  // ==========================================================
  // PHOTO UPLOAD
  // ==========================================================

  async function uploadPhoto(event) {
    const file =
      event.target.files?.[0];

    if (!file) {
      return;
    }

    setActionLoading(true);

    try {
      await api.uploadPhoto(file);

      setToast(
        "Progress photo saved successfully."
      );

      await refresh();

    } catch (error) {
      setToast(
        error?.message ||
          "Unable to upload photo."
      );

    } finally {
      event.target.value = "";
      setActionLoading(false);
    }
  }


  // ==========================================================
  // AI COACH
  // ==========================================================

  async function askCoach(prompt) {
    const question = prompt?.trim();

    if (!question || actionLoading) {
      return;
    }

    setCoachMessages((current) => [
      ...current,
      {
        role: "user",
        content: question,
      },
    ]);

    setActionLoading(true);

    try {
      const response = await api.coach(question);

      const answer =
        response?.recommendation ||
        response?.content ||
        "I couldn't generate a response.";

      setCoachMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: answer,
          title: response?.title || "MyFiTDay Coach",
          next_steps: response?.next_steps || [],
          safety_note: response?.safety_note || "",
          source: response?.source || "",
        },
      ]);
    } catch (error) {
      setToast(
        error?.message ||
          "Unable to get a response from the AI Coach."
      );
    } finally {
      setActionLoading(false);
    }
  }


  // ==========================================================
  // AUTH SCREEN
  // ==========================================================

  if (
    !user ||
    !token()
  ) {
    return (
      <Auth
        onAuth={handleAuth}
      />
    );
  }


  // ==========================================================
  // MAIN APPLICATION
  // ==========================================================

  return (
    <div className="app">

      {/* ====================================================
          SIDEBAR
          ==================================================== */}

      <aside className="sidebar">

        <Brand />

        <nav
          aria-label="Main navigation"
        >
          {TAB_NAMES.map(
            navigationTab => (
              <button
                type="button"
                key={navigationTab}
                className={
                  tab ===
                  navigationTab
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setTab(
                    navigationTab
                  )
                }
                aria-current={
                  tab ===
                  navigationTab
                    ? "page"
                    : undefined
                }
              >
                <span>
                  {
                    TAB_ICONS[
                      navigationTab
                    ]
                  }
                </span>

                {navigationTab}
              </button>
            )
          )}
        </nav>


        {/* ==================================================
            SIDEBAR ACTIONS
            ================================================== */}

        <div className="sideBottom">

          <button
            type="button"
            onClick={() =>
              setModal("goal")
            }
          >
            ◎ Goal
          </button>

          <button
            type="button"
            onClick={() =>
              setTheme(
                theme === "dark"
                  ? "light"
                  : "dark"
              )
            }
          >
            {theme === "dark"
              ? "☀ Light"
              : "☾ Dark"}
          </button>

          <button
            type="button"
            onClick={signOut}
          >
            ↪ Sign out
          </button>

        </div>

      </aside>


      {/* ====================================================
          MAIN CONTENT
          ==================================================== */}

      <main>

        {/* ==================================================
            HEADER
            ================================================== */}

        <header>

          <div>

            <span className="eyebrow">
              YOUR DAILY FITNESS COMPANION
            </span>

            <h1>
              {tab === "Today"
                ? `Good morning, ${user.username}.`
                : tab}
            </h1>

            <p className="muted">
              Track every set, build
              consistency, and see your
              progress.
            </p>

          </div>


          <div className="headerActions">

            <button
              type="button"
              className="iconBtn"
              onClick={() =>
                setTheme(
                  theme === "dark"
                    ? "light"
                    : "dark"
                )
              }
              aria-label="Toggle theme"
            >
              {theme === "dark"
                ? "☀"
                : "☾"}
            </button>

            <button
              type="button"
              className="avatar"
              aria-label={`Profile for ${user.username}`}
            >
              {user.username
                ?.charAt(0)
                .toUpperCase()}
            </button>

          </div>

        </header>


        {/* ==================================================
            GLOBAL LOADING
            ================================================== */}

        {loading && (
          <div
            className="loading"
            role="status"
            aria-live="polite"
          >
            Syncing MyFiTDay…
          </div>
        )}


        {/* ==================================================
            TODAY
            ================================================== */}

        {tab === "Today" && (
          <Today
            selected={selectedWorkout}
            day={day}
            setDay={setDay}
            summary={summary}
            goal={goal}
            weeklyProgress={
              weeklyProgress
            }
            currentProgress={
              currentProgress
            }
            completedIds={
              completedIds
            }
            toggle={
              toggleExercise
            }
            openGoal={() =>
              setModal("goal")
            }
            openCustomize={() =>
              setModal(
                "customize"
              )
            }
            actionLoading={
              actionLoading
            }
          />
        )}


        {/* ==================================================
            SCHEDULE
            ================================================== */}

        {tab === "Schedule" && (
          <Schedule
            workouts={workouts}
            sessions={sessions}
            selectedDay={day}
            setDay={setDay}
            openToday={() =>
              setTab("Today")
            }
          />
        )}


        {/* ==================================================
            PROGRESS
            ================================================== */}

        {tab === "Progress" && (
          <Progress
            summary={summary}
          />
        )}


        {/* ==================================================
            PHOTOS
            ================================================== */}

        {tab === "Photos" && (
          <Photos
            photos={photos}
            onUpload={uploadPhoto}
            disabled={
              actionLoading
            }
          />
        )}


        {/* ==================================================
            AI COACH
            ================================================== */}

        {tab === "AI Coach" && (
  <Coach
    messages={coachMessages}
    ask={askCoach}
    loading={actionLoading}
  />
)}


        {/* ==================================================
            FOOTER
            ================================================== */}

        <footer>

          <span>
            MyFiTDay • React + Django +
            PostgreSQL-ready + Ollama
          </span>

          <a
            href={
              import.meta.env
                .VITE_API_DOCS_URL ||
              "http://localhost:8000/api/docs/"
            }
            target="_blank"
            rel="noreferrer"
          >
            API docs
          </a>

        </footer>

      </main>


      {/* ====================================================
          GOAL MODAL
          ==================================================== */}

      {modal === "goal" && (
        <Modal
          title="Weekly calorie goal"
          close={() =>
            setModal(null)
          }
        >

          <p className="muted">
            Set a target for estimated
            workout calories. MyFiTDay
            treats this as a planning
            target, not a medical
            prescription.
          </p>

          <input
            className="bigInput"
            type="number"
            min="1"
            step="1"
            value={goal}
            onChange={event =>
              setGoal(
                event.target.value
              )
            }
          />

          <button
            type="button"
            className="primary full"
            onClick={saveGoal}
            disabled={
              actionLoading
            }
          >
            {actionLoading
              ? "Saving…"
              : "Save goal"}
          </button>

        </Modal>
      )}


      {/* ====================================================
          CUSTOMIZE MODAL
          ==================================================== */}

      {modal === "customize" && (
        <Customize
          workout={
            selectedWorkout
          }
          close={() =>
            setModal(null)
          }
          refresh={refresh}
          setToast={setToast}
          disabled={
            actionLoading
          }
        />
      )}


      {/* ====================================================
          TOAST
          ==================================================== */}

      {toast && (
        <div
          className="toast"
          role="alert"
          aria-live="assertive"
        >
          {toast}
        </div>
      )}

    </div>
  );
}


// ============================================================
// BRAND
// ============================================================

function Brand() {
  return (
    <div className="brand">

      <span className="brandMark">
        M
      </span>

      <div>
        <b>MyFiTDay</b>
        <small>
          SMART FITNESS
        </small>
      </div>

    </div>
  );
}


// ============================================================
// AUTHENTICATION
// ============================================================

function Auth({ onAuth }) {
  const [
    mode,
    setMode,
  ] = useState("login");

  const [
    form,
    setForm,
  ] = useState({
    username: "",
    email: "",
    password: "",
  });

  const [
    error,
    setError,
  ] = useState("");

  const [
    submitting,
    setSubmitting,
  ] = useState(false);


  async function submit(event) {
    event.preventDefault();

    setError("");

    if (submitting) {
      return;
    }

    setSubmitting(true);

    try {
      const response =
        mode === "login"
          ? await api.login(form)
          : await api.register(form);

      localStorage.setItem(
        "myfitday_token",
        response.token
      );

      localStorage.setItem(
        "myfitday_user",
        JSON.stringify(
          response.user
        )
      );

      onAuth(
        response.user
      );

    } catch (err) {
      setError(
        err?.message ||
          "Authentication failed."
      );

    } finally {
      setSubmitting(false);
    }
  }


  return (
    <div className="authPage">

      <div className="authCard">

        <Brand />

        <h1>
          {mode === "login"
            ? "Welcome back"
            : "Create your MyFiTDay account"}
        </h1>

        <p className="muted">
          Your workouts, goals and
          progress synced to your
          account.
        </p>


        <form
          onSubmit={submit}
        >

          <input
            placeholder="Username"
            value={
              form.username
            }
            onChange={event =>
              setForm({
                ...form,
                username:
                  event.target
                    .value,
              })
            }
            required
            autoComplete="username"
          />


          {mode ===
            "register" && (
            <input
              placeholder="Email"
              type="email"
              value={
                form.email
              }
              onChange={event =>
                setForm({
                  ...form,
                  email:
                    event.target
                      .value,
                })
              }
              autoComplete="email"
            />
          )}


          <input
            placeholder="Password (8+ characters)"
            type="password"
            value={
              form.password
            }
            onChange={event =>
              setForm({
                ...form,
                password:
                  event.target
                    .value,
              })
            }
            required
            minLength={8}
            autoComplete={
              mode === "login"
                ? "current-password"
                : "new-password"
            }
          />


          {error && (
            <div
              className="error"
              role="alert"
            >
              {error}
            </div>
          )}


          <button
            type="submit"
            className="primary full"
            disabled={submitting}
          >
            {submitting
              ? "Please wait…"
              : mode === "login"
              ? "Sign in"
              : "Create account"}
          </button>

        </form>


        <button
          type="button"
          className="linkBtn"
          onClick={() => {
            setMode(
              mode === "login"
                ? "register"
                : "login"
            );

            setError("");
          }}
        >
          {mode === "login"
            ? "New here? Create an account"
            : "Already have an account? Sign in"}
        </button>

      </div>

    </div>
  );
}


// ============================================================
// TODAY PAGE
// ============================================================

function Today({
  selected,
  day,
  setDay,
  summary,
  goal,
  weeklyProgress,
  currentProgress,
  completedIds,
  toggle,
  openGoal,
  openCustomize,
  actionLoading,
}) {
  const exercises =
    selected?.exercises || [];

  const completedCount =
    exercises.filter(
      exercise =>
        completedIds.has(
          Number(exercise.id)
        )
    ).length;


  const calories =
    calculateWorkoutCalories(
      selected
    );


  return (
    <>
      {/* ======================================================
          METRICS
          ====================================================== */}

      <section className="metrics">

        <Metric
          label="Workout duration"
          value={`${summary?.total_duration_minutes || 0} min`}
          sub="This week"
          icon="◷"
        />

        <Metric
          label="Avg. calories"
          value={`${summary?.average_daily_calories || 0} kcal`}
          sub="Per day"
          icon="♨"
        />

        <Metric
          label="Weekly goal"
          value={`${summary?.total_calories || 0} / ${goal}`}
          sub={`${weeklyProgress}% complete`}
          icon="◎"
        />

        <Metric
          label="Today's progress"
          value={`${currentProgress}%`}
          sub={day}
          icon="✓"
        />

      </section>


      <div className="grid">

        {/* ====================================================
            WEEKLY PLAN
            ==================================================== */}

        <section className="panel schedule">

          <div className="panelHead">

            <div>
              <span className="eyebrow">
                WEEKLY PLAN
              </span>

              <h2>
                Monday — Sunday
              </h2>
            </div>

            <button
              type="button"
              className="primary"
              onClick={openGoal}
            >
              Set goal
            </button>

          </div>


          <div className="dayRow">

            {DAYS.map(
              currentDay => (
                <button
                  type="button"
                  key={currentDay}
                  onClick={() =>
                    setDay(
                      currentDay
                    )
                  }
                  className={
                    day ===
                    currentDay
                      ? "selected"
                      : ""
                  }
                >
                  <b>
                    {currentDay.slice(
                      0,
                      3
                    )}
                  </b>

                  <span>
                    {day ===
                    currentDay
                      ? currentProgress
                      : 0}
                    %
                  </span>

                </button>
              )
            )}

          </div>

        </section>


        {/* ====================================================
            WORKOUT
            ==================================================== */}

        <section className="panel workout">

          <div className="panelHead">

            <div>

              <span className="eyebrow">
                {day.toUpperCase()}
              </span>

              <h2>
                {selected?.is_rest_day
                  ? "Recovery / Rest Day"
                  : selected?.name ||
                    `${day} Workout`}
              </h2>

            </div>

            {selected &&
              !selected.is_rest_day && (
                <button
                  type="button"
                  className="secondary"
                  onClick={
                    openCustomize
                  }
                >
                  Customize
                </button>
              )}

          </div>


          <div className="progressMeta">

            <span>
              {completedCount} of{" "}
              {exercises.length}{" "}
              exercises
            </span>

            <b>
              {currentProgress}%
            </b>

          </div>


          <div className="bar">
            <i
              style={{
                width: `${currentProgress}%`,
              }}
            />
          </div>


          {selected?.is_rest_day ? (
            <div className="empty">
              <h3>
                Recovery Day
              </h3>

              <p>
                Take time to recover
                and prepare for your
                next workout.
              </p>
            </div>
          ) : exercises.length ? (

            <div className="exerciseList">

              {exercises.map(
                exercise => {
                  const completed =
                    completedIds.has(
                      Number(
                        exercise.id
                      )
                    );

                  return (
                    <div
                      className={
                        "exercise " +
                        (completed
                          ? "done"
                          : "")
                      }
                      key={
                        exercise.id
                      }
                    >

                      <label>

                        <input
                          type="checkbox"
                          checked={
                            completed
                          }
                          disabled={
                            actionLoading
                          }
                          onChange={() =>
                            toggle(
                              exercise
                            )
                          }
                        />

                        <span className="check" />

                        <div>

                          <b>
                            {getExerciseName(
                              exercise
                            )}
                          </b>

                          <small>
                            {
                              exercise.sets
                            }{" "}
                            sets ×{" "}
                            {
                              exercise.reps
                            }{" "}
                            reps{" "}
                            ·{" "}
                            {Number(
                              exercise.weight_kg
                            )
                              ? `${exercise.weight_kg} kg`
                              : "Bodyweight"}
                          </small>

                        </div>

                      </label>


                      <span className="exerciseCal">
                        {getExerciseCalories(
                          exercise
                        )}{" "}
                        kcal
                      </span>

                    </div>
                  );
                }
              )}

            </div>

          ) : (
            <div className="empty">
              No exercises planned
              for this day.
            </div>
          )}


          <div className="workoutFooter">

            <span>
              Estimated burn{" "}
              <b>
                {calories} kcal
              </b>
            </span>

            <span>
              {selected
                ?.duration_minutes ||
                0}{" "}
              min
            </span>

          </div>

        </section>


        {/* ====================================================
            GOAL
            ==================================================== */}

        <section className="panel goal">

          <div className="panelHead">

            <div>

              <span className="eyebrow">
                CALORIE GOAL
              </span>

              <h2>
                {Number(
                  goal
                ).toLocaleString()}{" "}
                kcal / week
              </h2>

            </div>

            <span className="goalRing">
              {weeklyProgress}%
            </span>

          </div>


          <div className="goalTrack">
            <i
              style={{
                width: `${weeklyProgress}%`,
              }}
            />
          </div>


          <p className="muted">
            AI can recommend a
            gradual target based on
            your training history.
            Calorie estimates are
            planning estimates.
          </p>

        </section>


        {/* ====================================================
            AI COACH
            ==================================================== */}

        <section className="panel coach">

          <div className="coachIcon">
            ✦
          </div>

          <div>

            <span className="eyebrow">
              AI COACH
            </span>

            <h2>
              Train smarter, not
              just harder.
            </h2>

            <p>
              Ask the open-source AI
              coach for a
              recommendation based on
              your synced workout
              history.
            </p>

          </div>

        </section>

      </div>
    </>
  );
}


// ============================================================
// SCHEDULE PAGE
// ============================================================

function Schedule({
  workouts,
  sessions,
  selectedDay,
  setDay,
  openToday,
}) {
  const selectedWorkout =
    workouts.find(
      workout =>
        Number(
          workout.day_of_week
        ) ===
        dayNumber(selectedDay)
    ) || null;


  const selectedProgress =
    calculateWorkoutProgress(
      selectedWorkout,
      sessions
    );


  const selectedExerciseCount =
    selectedWorkout?.exercises
      ?.length || 0;


  const selectedCalories =
    calculateWorkoutCalories(
      selectedWorkout
    );


  return (
    <section className="page">

      {/* ======================================================
          HEADER
          ====================================================== */}

      <div className="pageTitle">

        <div>

          <span className="eyebrow">
            PLAN YOUR WEEK
          </span>

          <h2>
            Workout Schedule
          </h2>

          <p className="muted">
            Select a day to view your
            planned workout and
            completion progress.
          </p>

        </div>

      </div>


      {/* ======================================================
          WEEKLY SCHEDULE
          ====================================================== */}

      <div className="scheduleGrid">

        {DAYS.map(currentDay => {

          const workout =
            workouts.find(
              item =>
                Number(
                  item.day_of_week
                ) ===
                dayNumber(
                  currentDay
                )
            ) || null;


          const progress =
            calculateWorkoutProgress(
              workout,
              sessions
            );


          const exerciseCount =
            workout?.exercises
              ?.length || 0;


          return (
            <article
              className={
                "scheduleDay " +
                (selectedDay ===
                currentDay
                  ? "selected"
                  : "")
              }
              key={currentDay}
            >

              <button
                type="button"
                className="scheduleDayButton"
                onClick={() =>
                  setDay(
                    currentDay
                  )
                }
                aria-pressed={
                  selectedDay ===
                  currentDay
                }
              >

                <div>

                  <b>
                    {currentDay}
                  </b>

                  <span>
                    {workout?.is_rest_day
                      ? "Recovery day"
                      : workout
                      ? `${exerciseCount} exercises`
                      : "No workout planned"}
                  </span>

                </div>


                <strong>
                  {progress}%
                </strong>

              </button>


              {/* Progress */}

              <div className="miniBar">

                <i
                  style={{
                    width: `${progress}%`,
                  }}
                />

              </div>


              {/* Workout name */}

              <div
                className="scheduleDayMeta"
              >
                {workout &&
                !workout.is_rest_day
                  ? workout.name
                  : workout?.is_rest_day
                  ? "Recovery"
                  : "Not scheduled"}
              </div>

            </article>
          );
        })}

      </div>


      {/* ======================================================
          SELECTED DAY DETAILS
          ====================================================== */}

      <section className="panel">

        <div className="panelHead">

          <div>

            <span className="eyebrow">
              {selectedDay.toUpperCase()}
            </span>

            <h2>
              {selectedWorkout?.is_rest_day
                ? "Recovery / Rest Day"
                : selectedWorkout?.name ||
                  `${selectedDay} Workout`}
            </h2>

          </div>


          <button
            type="button"
            className="primary"
            onClick={openToday}
          >
            Open workout
          </button>

        </div>


        {/* ====================================================
            NO WORKOUT
            ==================================================== */}

        {!selectedWorkout && (
          <div className="empty">

            <h3>
              No workout planned
            </h3>

            <p>
              There is currently no
              workout scheduled for{" "}
              {selectedDay}.
            </p>

          </div>
        )}


        {/* ====================================================
            REST DAY
            ==================================================== */}

        {selectedWorkout?.is_rest_day && (
          <div className="empty">

            <h3>
              Recovery Day
            </h3>

            <p>
              Take time to recover
              before your next training
              session.
            </p>

          </div>
        )}


        {/* ====================================================
            WORKOUT SUMMARY
            ==================================================== */}

        {selectedWorkout &&
          !selectedWorkout.is_rest_day && (
            <>
              <div className="analytics">

                <Metric
                  label="Exercises"
                  value={
                    selectedExerciseCount
                  }
                  sub="Planned"
                  icon="✓"
                />

                <Metric
                  label="Progress"
                  value={`${selectedProgress}%`}
                  sub="Completed"
                  icon="◔"
                />

                <Metric
                  label="Estimated burn"
                  value={`${selectedCalories} kcal`}
                  sub="Planning estimate"
                  icon="♨"
                />

              </div>


              {/* ==================================================
                  EXERCISE LIST
                  ================================================== */}

              {selectedExerciseCount >
              0 ? (
                <div className="exerciseList">

                  {selectedWorkout.exercises.map(
                    (exercise, index) => (

                      <div
                        className="exercise"
                        key={
                          exercise.id ||
                          index
                        }
                      >

                        <div>

                          <b>
                            {getExerciseName(
                              exercise
                            )}
                          </b>

                          <small>
                            {
                              exercise.sets
                            }{" "}
                            sets ×{" "}
                            {
                              exercise.reps
                            }{" "}
                            reps{" "}
                            ·{" "}
                            {Number(
                              exercise.weight_kg
                            )
                              ? `${exercise.weight_kg} kg`
                              : "Bodyweight"}
                          </small>

                        </div>


                        <span className="exerciseCal">
                          {getExerciseCalories(
                            exercise
                          )}{" "}
                          kcal
                        </span>

                      </div>
                    )
                  )}

                </div>
              ) : (
                <div className="empty">
                  No exercises have
                  been added to this
                  workout.
                </div>
              )}

            </>
          )}

      </section>

    </section>
  );
}


// ============================================================
// PROGRESS PAGE
// ============================================================

function Progress({
  summary,
}) {
  const daily =
    summary?.daily || [];


  const totalCalories =
    Number(
      summary?.total_calories || 0
    );


  return (
    <section className="page">

      <div className="pageTitle">

        <div>

          <span className="eyebrow">
            YOUR HISTORY
          </span>

          <h2>
            Progress Analytics
          </h2>

        </div>

      </div>


      <div className="analytics">

        <Metric
          label="Weekly calories"
          value={`${totalCalories} kcal`}
          sub="Estimated"
          icon="♨"
        />

        <Metric
          label="Daily average"
          value={`${summary?.average_daily_calories || 0} kcal`}
          sub="7-day average"
          icon="◔"
        />

        <Metric
          label="Workout time"
          value={`${summary?.total_duration_minutes || 0} min`}
          sub="This week"
          icon="◷"
        />

      </div>


      <div className="panel chart">

        <h3>
          Calories by day
        </h3>

        {daily.length ? (
          <div className="bars">

            {daily.map(
              dayData => {

                const percentage =
                  totalCalories > 0
                    ? Math.min(
                        100,
                        Math.round(
                          (Number(
                            dayData.calories ||
                              0
                          ) /
                            totalCalories) *
                            100
                        )
                      )
                    : 0;

                return (
                  <div
                    key={
                      dayData.date
                    }
                  >

                    <div className="barCol">

                      <i
                        style={{
                          height: `${percentage}%`,
                        }}
                        title={`${dayData.calories || 0} kcal`}
                      />

                    </div>

                    <span>
                      {dayData.day?.slice(
                        0,
                        3
                      )}
                    </span>

                    <small>
                      {
                        dayData.calories ||
                        0
                      }
                    </small>

                  </div>
                );
              }
            )}

          </div>
        ) : (
          <div className="empty">
            No progress data available
            yet.
          </div>
        )}

      </div>

    </section>
  );
}


// ============================================================
// PHOTOS PAGE
// ============================================================

function Photos({
  photos,
  onUpload,
  disabled,
}) {
  function exportUrl(range) {
    return api.photoExportUrl(
      range
    );
  }


  function imageUrl(path) {
    if (!path) {
      return "";
    }

    if (
      path.startsWith("http://") ||
      path.startsWith("https://")
    ) {
      return path;
    }

    const baseUrl =
      import.meta.env
        .VITE_API_BASE_URL ||
      "http://localhost:8000";

    return `${baseUrl}${path}`;
  }


  return (
    <section className="page">

      <div className="pageTitle">

        <div>

          <span className="eyebrow">
            VISUAL PROGRESS
          </span>

          <h2>
            Progress Photos
          </h2>

          <p className="muted">
            Photos are stored on the
            Django server and linked
            to your account.
          </p>

        </div>


        <div className="photoActions">

          <a
            className="secondary"
            href={exportUrl("week")}
          >
            Download week
          </a>

          <a
            className="secondary"
            href={exportUrl("month")}
          >
            Download month
          </a>

          <label className="primary uploadBtn">

            + Add today

            <input
              hidden
              type="file"
              accept="image/*"
              capture="environment"
              onChange={onUpload}
              disabled={disabled}
            />

          </label>

        </div>

      </div>


      <div className="photoGrid">

        {photos.length ? (
          photos.map(photo => {

            const url =
              imageUrl(
                photo.image
              );

            return (
              <div
                className="photoCard"
                key={photo.id}
              >

                <img
                  src={url}
                  alt={`Progress photo from ${new Date(
                    photo.captured_at
                  ).toLocaleDateString()}`}
                />

                <div>

                  <b>
                    {new Date(
                      photo.captured_at
                    ).toLocaleDateString()}
                  </b>

                  <a
                    href={url}
                    download
                  >
                    Download
                  </a>

                </div>

              </div>
            );
          })
        ) : (
          <div className="empty wide">
            No progress photos yet.
            Add one today.
          </div>
        )}

      </div>

    </section>
  );
}


// ============================================================
// AI COACH
// ============================================================

function Coach({
  messages,
  ask,
  loading,
}) {
  const [input, setInput] = useState("");

  function submit(event) {
    event.preventDefault();

    const question = input.trim();

    if (!question || loading) {
      return;
    }

    ask(question);
    setInput("");
  }

  return (
    <section className="page">

      <div className="coachHero">

        <div className="coachIcon big">
          ✦
        </div>

        <div>
          <span className="eyebrow">
            MYFITDAY AI COACH
          </span>

          <h2>
            Your personal fitness assistant.
          </h2>

          <p>
            Ask me anything about workouts,
            exercises, training, recovery,
            goals, or your progress.
          </p>
        </div>

      </div>

      <div className="panel coachChat">

        <div className="coachMessages">

          {messages.map((message, index) => (
            <div
              key={index}
              className={
                message.role === "user"
                  ? "coachMessage userMessage"
                  : "coachMessage assistantMessage"
              }
            >

              <div className="coachMessageLabel">
                {message.role === "user"
                  ? "You"
                  : "MyFiTDay Coach"}
              </div>

              <div className="coachMessageContent">
                {message.content}
              </div>

              {message.next_steps &&
                message.next_steps.length > 0 && (
                  <div className="coachNextSteps">
                    <strong>Next steps</strong>

                    <ul>
                      {message.next_steps.map(
                        (step, stepIndex) => (
                          <li key={stepIndex}>
                            {step}
                          </li>
                        )
                      )}
                    </ul>
                  </div>
                )}

              {message.safety_note && (
                <div className="coachSafety">
                  {message.safety_note}
                </div>
              )}

            </div>
          ))}

          {loading && (
            <div className="coachMessage assistantMessage">
              <div className="coachMessageLabel">
                MyFiTDay Coach
              </div>

              <div className="coachMessageContent">
                Thinking…
              </div>
            </div>
          )}

        </div>

        <form
          className="coachInputArea"
          onSubmit={submit}
        >
          <input
            type="text"
            value={input}
            onChange={(event) =>
              setInput(event.target.value)
            }
            placeholder="Ask anything about fitness..."
            disabled={loading}
          />

          <button
            type="submit"
            className="primary"
            disabled={loading || !input.trim()}
          >
            {loading ? "Thinking…" : "Send"}
          </button>
        </form>

      </div>

    </section>
  );
}


// ============================================================
// CUSTOMIZE WORKOUT
// ============================================================

function Customize({
  workout,
  close,
  refresh,
  setToast,
  disabled,
}) {
  const [
    name,
    setName,
  ] = useState(
    workout?.name || ""
  );


  const [
    duration,
    setDuration,
  ] = useState(
    workout?.duration_minutes ||
      0
  );


  const [
    items,
    setItems,
  ] = useState(
    (workout?.exercises || [])
      .map(exercise => ({
        ...exercise,
        name:
          exercise?.exercise
            ?.name || "",
      }))
  );


  const [
    newName,
    setNewName,
  ] = useState("");


  const [
    saving,
    setSaving,
  ] = useState(false);


  async function save() {
    if (
      !workout?.id ||
      saving ||
      disabled
    ) {
      return;
    }

    setSaving(true);

    try {

      await api.updateWorkout(
        workout.id,
        {
          name:
            name.trim() ||
            "Workout",

          duration_minutes:
            Math.max(
              0,
              Number(
                duration
              ) || 0
            ),
        }
      );


      for (
        const exercise of items
      ) {

        await api.updateExercise(
          workout.id,
          exercise.id,
          {
            name:
              exercise.name.trim() ||
              "Exercise",

            sets: Math.max(
              1,
              Number(
                exercise.sets
              ) || 1
            ),

            reps: Math.max(
              1,
              Number(
                exercise.reps
              ) || 1
            ),

            weight_kg:
              Math.max(
                0,
                Number(
                  exercise.weight_kg
                ) || 0
              ),
          }
        );
      }


      setToast(
        "Workout customized successfully."
      );

      close();

      await refresh();

    } catch (error) {

      setToast(
        error?.message ||
          "Unable to customize workout."
      );

    } finally {
      setSaving(false);
    }
  }


  async function add() {
    const trimmedName =
      newName.trim();

    if (
      !trimmedName ||
      !workout?.id ||
      saving ||
      disabled
    ) {
      return;
    }

    setSaving(true);

    try {

      await api.addExercise(
        workout.id,
        {
          name:
            trimmedName,

          sets: 3,

          reps: 10,

          weight_kg: 0,
        }
      );

      setNewName("");

      await refresh();

      setToast(
        "Exercise added successfully."
      );

    } catch (error) {

      setToast(
        error?.message ||
          "Unable to add exercise."
      );

    } finally {
      setSaving(false);
    }
  }


  async function remove(
    exerciseId
  ) {
    if (
      !exerciseId ||
      saving ||
      disabled
    ) {
      return;
    }

    setSaving(true);

    try {

      await api.deleteExercise(
        workout.id,
        exerciseId
      );

      setItems(
        currentItems =>
          currentItems.filter(
            item =>
              item.id !==
              exerciseId
          )
      );

      await refresh();

      setToast(
        "Exercise removed successfully."
      );

    } catch (error) {

      setToast(
        error?.message ||
          "Unable to remove exercise."
      );

    } finally {
      setSaving(false);
    }
  }


  if (!workout) {
    return null;
  }


  return (
    <Modal
      title={`Customize ${
        DAYS[
          (workout.day_of_week ||
            1) - 1
        ]
      }`}
      close={close}
    >

      <input
        placeholder="Workout name"
        value={name}
        onChange={event =>
          setName(
            event.target.value
          )
        }
        disabled={saving}
      />


      <input
        type="number"
        min="0"
        placeholder="Duration (minutes)"
        value={duration}
        onChange={event =>
          setDuration(
            event.target.value
          )
        }
        disabled={saving}
      />


      <div className="formList">

        {items.map(
          exercise => (
            <div
              className="editRow"
              key={exercise.id}
            >

              <input
                value={
                  exercise.name
                }
                onChange={event =>
                  setItems(
                    currentItems =>
                      currentItems.map(
                        item =>
                          item.id ===
                          exercise.id
                            ? {
                                ...item,
                                name:
                                  event
                                    .target
                                    .value,
                              }
                            : item
                      )
                  )
                }
                disabled={saving}
              />


              <input
                type="number"
                min="1"
                value={
                  exercise.sets
                }
                onChange={event =>
                  setItems(
                    currentItems =>
                      currentItems.map(
                        item =>
                          item.id ===
                          exercise.id
                            ? {
                                ...item,
                                sets:
                                  event
                                    .target
                                    .value,
                              }
                            : item
                      )
                  )
                }
                disabled={saving}
              />


              <input
                type="number"
                min="1"
                value={
                  exercise.reps
                }
                onChange={event =>
                  setItems(
                    currentItems =>
                      currentItems.map(
                        item =>
                          item.id ===
                          exercise.id
                            ? {
                                ...item,
                                reps:
                                  event
                                    .target
                                    .value,
                              }
                            : item
                      )
                  )
                }
                disabled={saving}
              />


              <button
                type="button"
                className="danger"
                onClick={() =>
                  remove(
                    exercise.id
                  )
                }
                disabled={saving}
                aria-label={`Remove ${exercise.name}`}
              >
                ×
              </button>

            </div>
          )
        )}

      </div>


      <div className="editRow">

        <input
          placeholder="New exercise"
          value={newName}
          onChange={event =>
            setNewName(
              event.target.value
            )
          }
          disabled={saving}
        />

        <button
          type="button"
          className="secondary"
          onClick={add}
          disabled={saving}
          style={{
            gridColumn:
              "2 / -1",
          }}
        >
          {saving
            ? "Saving…"
            : "+ Add"}
        </button>

      </div>


      <button
        type="button"
        className="primary full"
        onClick={save}
        disabled={saving}
      >
        {saving
          ? "Saving workout…"
          : "Save workout"}
      </button>

    </Modal>
  );
}


// ============================================================
// METRIC
// ============================================================

function Metric({
  label,
  value,
  sub,
  icon,
}) {
  return (
    <div className="metric">

      <span className="metricIcon">
        {icon}
      </span>

      <div>

        <small>
          {label}
        </small>

        <strong>
          {value}
        </strong>

        <em>
          {sub}
        </em>

      </div>

    </div>
  );
}


// ============================================================
// MODAL
// ============================================================

function Modal({
  title,
  close,
  children,
}) {
  function handleOverlayClick(
    event
  ) {
    if (
      event.target ===
      event.currentTarget
    ) {
      close();
    }
  }


  return (
    <div
      className="overlay"
      onMouseDown={
        handleOverlayClick
      }
      role="presentation"
    >

      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onMouseDown={event =>
          event.stopPropagation()
        }
      >

        <div className="modalHead">

          <h2 id="modal-title">
            {title}
          </h2>

          <button
            type="button"
            onClick={close}
            aria-label="Close"
          >
            ×
          </button>

        </div>

        {children}

      </div>

    </div>
  );
}


// ============================================================
// APPLICATION BOOTSTRAP
// ============================================================

const root =
  document.getElementById(
    "root"
  );

if (!root) {
  throw new Error(
    "MyFiTDay root element was not found."
  );
}

createRoot(root).render(
  <App />
);