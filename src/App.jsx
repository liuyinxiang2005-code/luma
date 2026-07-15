import { useEffect, useMemo, useState } from 'react'
import './App.css'

const HABITS_STORAGE_KEY = 'luma-habits-v2'
const RECORDS_STORAGE_KEY = 'luma-daily-records-v1'

const initialHabits = [
  {
    id: 'morning-stretch',
    name: 'Morning stretch',
    icon: '☀️',
  },
  {
    id: 'reading',
    name: 'Read for 20 minutes',
    icon: '📖',
  },
  {
    id: 'water',
    name: 'Drink enough water',
    icon: '💧',
  },
]

function getDateKey(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function formatDisplayDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(date)
}

function dateFromKey(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function shiftDate(date, days) {
  const shiftedDate = new Date(date)
  shiftedDate.setDate(shiftedDate.getDate() + days)
  return shiftedDate
}

function getRecordStats(dateRecords, fallbackTotal = 0) {
  if (!Array.isArray(dateRecords)) {
    return { completed: 0, total: fallbackTotal, percentage: 0 }
  }

  const completed = dateRecords.filter((record) => record.completed).length
  const total = dateRecords.length

  return {
    completed,
    total,
    percentage: total === 0 ? 0 : Math.round((completed / total) * 100),
  }
}

function loadHabits() {
  try {
    const savedHabits = localStorage.getItem(HABITS_STORAGE_KEY)

    if (!savedHabits) {
      return initialHabits
    }

    const parsedHabits = JSON.parse(savedHabits)

    return Array.isArray(parsedHabits) && parsedHabits.length > 0
      ? parsedHabits
      : initialHabits
  } catch {
    return initialHabits
  }
}

function loadRecords() {
  try {
    const savedRecords = localStorage.getItem(RECORDS_STORAGE_KEY)

    if (!savedRecords) {
      return {}
    }

    const parsedRecords = JSON.parse(savedRecords)

    return parsedRecords &&
      typeof parsedRecords === 'object' &&
      !Array.isArray(parsedRecords)
      ? parsedRecords
      : {}
  } catch {
    return {}
  }
}

function createTodayHabits(habitDefinitions, records, dateKey) {
  const savedToday = records[dateKey]

  return habitDefinitions.map((habit) => {
    const savedHabit = Array.isArray(savedToday)
      ? savedToday.find((item) => item.id === habit.id)
      : undefined

    return {
      ...habit,
      completed: savedHabit?.completed ?? false,
    }
  })
}

function createHabitId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }

  return `habit-${Date.now()}`
}

function App() {
  const today = new Date()
  const todayKey = getDateKey(today)
  const displayDate = formatDisplayDate(today)

  const [habitDefinitions, setHabitDefinitions] = useState(loadHabits)
  const [records, setRecords] = useState(loadRecords)

  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isManageOpen, setIsManageOpen] = useState(false)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [selectedHistoryDate, setSelectedHistoryDate] = useState(todayKey)
  const [editingHabitId, setEditingHabitId] = useState(null)
  const [newHabitName, setNewHabitName] = useState('')
  const [newHabitIcon, setNewHabitIcon] = useState('✨')
  const [editHabitName, setEditHabitName] = useState('')
  const [editHabitIcon, setEditHabitIcon] = useState('')

  const habits = useMemo(
    () =>
      createTodayHabits(
        habitDefinitions,
        records,
        todayKey,
      ),
    [habitDefinitions, records, todayKey],
  )

  useEffect(() => {
    localStorage.setItem(
      HABITS_STORAGE_KEY,
      JSON.stringify(habitDefinitions),
    )
  }, [habitDefinitions])

  useEffect(() => {
    localStorage.setItem(
      RECORDS_STORAGE_KEY,
      JSON.stringify(records),
    )
  }, [records])

  const completedCount = useMemo(
    () => habits.filter((habit) => habit.completed).length,
    [habits],
  )

  const progress =
    habits.length === 0
      ? 0
      : Math.round((completedCount / habits.length) * 100)

  const historySummary = useMemo(() => {
    const recordedDates = Object.keys(records)
      .filter((dateKey) => Array.isArray(records[dateKey]))
      .sort()

    const completionRate = recordedDates.length
      ? Math.round(
          recordedDates.reduce(
            (total, dateKey) =>
              total + getRecordStats(records[dateKey]).percentage,
            0,
          ) / recordedDates.length,
        )
      : 0

    let currentStreak = 0
    const currentDate = dateFromKey(todayKey)
    let cursor = currentDate

    while (true) {
      const dayStats = getRecordStats(records[getDateKey(cursor)])

      if (dayStats.total === 0 || dayStats.percentage !== 100) {
        break
      }

      currentStreak += 1
      cursor = shiftDate(cursor, -1)
    }

    let bestStreak = 0
    let runningStreak = 0
    let previousCompleteDate = null

    recordedDates.forEach((dateKey) => {
      const dayStats = getRecordStats(records[dateKey])

      if (dayStats.total === 0 || dayStats.percentage !== 100) {
        runningStreak = 0
        previousCompleteDate = null
        return
      }

      const isConsecutive =
        previousCompleteDate &&
        getDateKey(shiftDate(dateFromKey(previousCompleteDate), 1)) === dateKey

      runningStreak = isConsecutive ? runningStreak + 1 : 1
      bestStreak = Math.max(bestStreak, runningStreak)
      previousCompleteDate = dateKey
    })

    const heatmapDays = Array.from({ length: 35 }, (_, index) => {
      const date = shiftDate(currentDate, index - 34)
      const dateKey = getDateKey(date)

      return {
        date,
        dateKey,
        ...getRecordStats(records[dateKey], habitDefinitions.length),
      }
    })

    return { currentStreak, bestStreak, completionRate, heatmapDays }
  }, [habitDefinitions.length, records, todayKey])

  const selectedDay =
    historySummary.heatmapDays.find(
      (day) => day.dateKey === selectedHistoryDate,
    ) ?? historySummary.heatmapDays.at(-1)

  function toggleHabit(id) {
    const updatedHabits = habits.map((habit) =>
      habit.id === id
        ? {
            ...habit,
            completed: !habit.completed,
          }
        : habit,
    )

    setRecords((currentRecords) => ({
      ...currentRecords,
      [todayKey]: updatedHabits.map((habit) => ({
        id: habit.id,
        completed: habit.completed,
      })),
    }))
  }

  function openAddHabit() {
    setNewHabitName('')
    setNewHabitIcon('✨')
    setIsAddOpen(true)
  }

  function closeAddHabit() {
    setIsAddOpen(false)
  }

  function openEditHabit(habit) {
    setEditHabitName(habit.name)
    setEditHabitIcon(habit.icon)
    setEditingHabitId(habit.id)
  }

  function closeEditHabit() {
    setEditingHabitId(null)
  }

  function editHabit(event) {
    event.preventDefault()

    const trimmedName = editHabitName.trim()
    const trimmedIcon = editHabitIcon.trim()

    if (!trimmedName || !editingHabitId) {
      return
    }

    setHabitDefinitions((currentHabits) =>
      currentHabits.map((habit) =>
        habit.id === editingHabitId
          ? {
              ...habit,
              name: trimmedName,
              icon: trimmedIcon || '✨',
            }
          : habit,
      ),
    )

    closeEditHabit()
  }

  function deleteHabit(id) {
    if (habitDefinitions.length <= 1) {
      return
    }

    const shouldDelete = window.confirm(
      'Delete this habit? Its previous check-in records will also be removed.',
    )

    if (!shouldDelete) {
      return
    }

    setHabitDefinitions((currentHabits) =>
      currentHabits.filter((habit) => habit.id !== id),
    )

    setRecords((currentRecords) =>
      Object.fromEntries(
        Object.entries(currentRecords).map(([date, dateRecords]) => [
          date,
          Array.isArray(dateRecords)
            ? dateRecords.filter((record) => record.id !== id)
            : dateRecords,
        ]),
      ),
    )
  }

  function addHabit(event) {
    event.preventDefault()

    const trimmedName = newHabitName.trim()
    const trimmedIcon = newHabitIcon.trim()

    if (!trimmedName) {
      return
    }

    const newHabit = {
      id: createHabitId(),
      name: trimmedName,
      icon: trimmedIcon || '✨',
    }

    setHabitDefinitions((currentHabits) => [
      ...currentHabits,
      newHabit,
    ])

    setNewHabitName('')
    setNewHabitIcon('✨')
    setIsAddOpen(false)
  }

  return (
    <main className="app-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <section
        className="dashboard"
        aria-label="Luma habit dashboard"
      >
        <header className="topbar">
          <div>
            <p className="eyebrow">{displayDate}</p>
            <h1>Luma</h1>
          </div>

          <button
            className="profile-button"
            type="button"
            aria-label="Open profile"
          >
            S
          </button>
        </header>

        <section className="progress-card">
          <div className="progress-copy">
            <p className="section-label">Today</p>

            <h2>
              {completedCount} of {habits.length} completed
            </h2>

            <p>Small steps, beautifully repeated.</p>
          </div>

          <div
            className="progress-ring"
            style={{
              '--progress': `${progress * 3.6}deg`,
            }}
          >
            <div className="progress-ring-inner">
              <strong>{progress}%</strong>
              <span>done</span>
            </div>
          </div>
        </section>

        <section className="habits-section">
          <div className="section-heading">
            <div>
              <p className="section-label">Your rhythm</p>
              <h2>Today&apos;s habits</h2>
            </div>

            <div className="section-actions">
              <button
                className="text-button"
                type="button"
                onClick={() => {
                  setSelectedHistoryDate(todayKey)
                  setIsHistoryOpen(true)
                }}
              >
                History
              </button>
              <button
                className="text-button"
                type="button"
                onClick={() => setIsManageOpen(true)}
              >
                Manage
              </button>
            </div>
          </div>

          <div className="habit-list">
            {habits.map((habit) => (
              <button
                key={habit.id}
                type="button"
                className={`habit-card ${
                  habit.completed ? 'completed' : ''
                }`}
                onClick={() => toggleHabit(habit.id)}
                aria-pressed={habit.completed}
              >
                <span
                  className="habit-icon"
                  aria-hidden="true"
                >
                  {habit.icon}
                </span>

                <span className="habit-copy">
                  <strong>{habit.name}</strong>

                  <small>
                    {habit.completed
                      ? 'Completed today'
                      : 'Tap to complete'}
                  </small>
                </span>

                <span
                  className="checkmark"
                  aria-hidden="true"
                >
                  {habit.completed ? '✓' : ''}
                </span>
              </button>
            ))}
          </div>
        </section>

        <button
          className="add-button"
          type="button"
          aria-label="Add a new habit"
          onClick={openAddHabit}
        >
          <span>+</span>
        </button>
      </section>

      {isAddOpen && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={closeAddHabit}
        >
          <section
            className="add-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-habit-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <p className="section-label">New rhythm</p>
                <h2 id="add-habit-title">Add a habit</h2>
              </div>

              <button
                className="close-button"
                type="button"
                aria-label="Close"
                onClick={closeAddHabit}
              >
                ×
              </button>
            </div>

            <form
              className="habit-form"
              onSubmit={addHabit}
            >
              <label className="field-label">
                Habit name

                <input
                  type="text"
                  value={newHabitName}
                  onChange={(event) =>
                    setNewHabitName(event.target.value)
                  }
                  placeholder="For example: Practice French"
                  maxLength={50}
                  autoFocus
                />
              </label>

              <label className="field-label">
                Icon

                <input
                  className="icon-input"
                  type="text"
                  value={newHabitIcon}
                  onChange={(event) =>
                    setNewHabitIcon(event.target.value)
                  }
                  placeholder="✨"
                  maxLength={4}
                />
              </label>

              <button
                className="save-habit-button"
                type="submit"
                disabled={!newHabitName.trim()}
              >
                Add habit
              </button>
            </form>
          </section>
        </div>
      )}

      {isManageOpen && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={() => setIsManageOpen(false)}
        >
          <section
            className="add-modal manage-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="manage-habits-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <p className="section-label">Your rhythm</p>
                <h2 id="manage-habits-title">Manage habits</h2>
              </div>

              <button
                className="close-button"
                type="button"
                aria-label="Close"
                onClick={() => setIsManageOpen(false)}
              >
                ×
              </button>
            </div>

            <div className="manage-habit-list">
              {habitDefinitions.map((habit) => (
                <div className="manage-habit-item" key={habit.id}>
                  <span className="habit-icon" aria-hidden="true">
                    {habit.icon}
                  </span>
                  <strong>{habit.name}</strong>
                  <div className="manage-habit-actions">
                    <button
                      className="edit-habit-button"
                      type="button"
                      onClick={() => openEditHabit(habit)}
                    >
                      Edit
                    </button>
                    <button
                      className="delete-habit-button"
                      type="button"
                      disabled={habitDefinitions.length === 1}
                      title={
                        habitDefinitions.length === 1
                          ? 'At least one habit is required'
                          : undefined
                      }
                      onClick={() => deleteHabit(habit.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {isHistoryOpen && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={() => setIsHistoryOpen(false)}
        >
          <section
            className="add-modal history-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="history-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <p className="section-label">History</p>
                <h2 id="history-title">Your progress</h2>
              </div>

              <button
                className="close-button"
                type="button"
                aria-label="Close"
                onClick={() => setIsHistoryOpen(false)}
              >
                ×
              </button>
            </div>

            <div className="history-stats">
              <div className="history-stat-card">
                <span>Current streak</span>
                <strong>{historySummary.currentStreak}</strong>
                <small>days</small>
              </div>
              <div className="history-stat-card">
                <span>Best streak</span>
                <strong>{historySummary.bestStreak}</strong>
                <small>days</small>
              </div>
              <div className="history-stat-card">
                <span>Completion rate</span>
                <strong>{historySummary.completionRate}%</strong>
                <small>average</small>
              </div>
            </div>

            <div className="heatmap-section">
              <div className="heatmap-heading">
                <div>
                  <p className="section-label">Last 35 days</p>
                  <strong>Daily completion</strong>
                </div>
                <div className="heatmap-legend" aria-label="Completion scale">
                  <i className="heat-level-0" />
                  <i className="heat-level-1" />
                  <i className="heat-level-2" />
                  <i className="heat-level-3" />
                </div>
              </div>

              <div className="heatmap-grid">
                {historySummary.heatmapDays.map((day) => {
                  const level =
                    day.percentage === 100
                      ? 3
                      : day.percentage >= 50
                        ? 2
                        : day.percentage > 0
                          ? 1
                          : 0

                  return (
                    <button
                      key={day.dateKey}
                      className={`heatmap-day heat-level-${level} ${
                        day.dateKey === todayKey ? 'today' : ''
                      } ${
                        day.dateKey === selectedDay.dateKey ? 'selected' : ''
                      }`}
                      type="button"
                      aria-label={`${formatDisplayDate(day.date)}: ${day.completed} of ${day.total}, ${day.percentage}%`}
                      onMouseEnter={() => setSelectedHistoryDate(day.dateKey)}
                      onFocus={() => setSelectedHistoryDate(day.dateKey)}
                      onClick={() => setSelectedHistoryDate(day.dateKey)}
                    >
                      <span>{day.date.getDate()}</span>
                    </button>
                  )
                })}
              </div>

              <div className="heatmap-detail" aria-live="polite">
                <strong>{formatDisplayDate(selectedDay.date)}</strong>
                <span>
                  {selectedDay.completed} of {selectedDay.total} habits completed
                </span>
                <b>{selectedDay.percentage}%</b>
              </div>
            </div>
          </section>
        </div>
      )}

      {editingHabitId && (
        <div
          className="modal-backdrop edit-modal-backdrop"
          role="presentation"
          onMouseDown={closeEditHabit}
        >
          <section
            className="add-modal edit-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-habit-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <p className="section-label">Refine your rhythm</p>
                <h2 id="edit-habit-title">Edit habit</h2>
              </div>

              <button
                className="close-button"
                type="button"
                aria-label="Close"
                onClick={closeEditHabit}
              >
                ×
              </button>
            </div>

            <form className="habit-form" onSubmit={editHabit}>
              <label className="field-label">
                Habit name

                <input
                  type="text"
                  value={editHabitName}
                  onChange={(event) =>
                    setEditHabitName(event.target.value)
                  }
                  maxLength={50}
                  autoFocus
                />
              </label>

              <label className="field-label">
                Icon

                <input
                  className="icon-input"
                  type="text"
                  value={editHabitIcon}
                  onChange={(event) =>
                    setEditHabitIcon(event.target.value)
                  }
                  placeholder="✨"
                  maxLength={4}
                />
              </label>

              <button
                className="save-habit-button"
                type="submit"
                disabled={!editHabitName.trim()}
              >
                Save changes
              </button>
            </form>
          </section>
        </div>
      )}
    </main>
  )
}

export default App
