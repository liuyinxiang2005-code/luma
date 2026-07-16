import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

const HABITS_STORAGE_KEY = 'luma-habits-v2'
const RECORDS_STORAGE_KEY = 'luma-daily-records-v1'
const BACKGROUND_STORAGE_KEY = 'luma-selected-background'

const backgroundOptions = [
  { id: 'original', name: 'Original', type: 'gradient' },
  { id: 'nature', name: 'Nature', image: '/backgrounds/nature.jpeg' },
  { id: 'statues', name: 'Statues', image: '/backgrounds/statues.jpeg' },
  {
    id: 'stream-glass',
    name: 'Glass Stream',
    image: '/backgrounds/stream-glass.jpeg',
  },
  { id: 'spheres', name: 'Spheres', image: '/backgrounds/spheres.jpeg' },
]

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

function loadSelectedBackground() {
  try {
    const savedId = localStorage.getItem(BACKGROUND_STORAGE_KEY)
    return backgroundOptions.some((option) => option.id === savedId)
      ? savedId
      : 'original'
  } catch {
    return 'original'
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
  const [isAppearanceOpen, setIsAppearanceOpen] = useState(false)
  const [selectedBackground, setSelectedBackground] = useState(
    loadSelectedBackground,
  )
  const [backgroundLayers, setBackgroundLayers] = useState({
    current: 'original',
    previous: null,
  })
  const [loadedBackgrounds, setLoadedBackgrounds] = useState(() =>
    new Set(['original']),
  )
  const [selectedHistoryDate, setSelectedHistoryDate] = useState(todayKey)
  const [editingHabitId, setEditingHabitId] = useState(null)
  const [newHabitName, setNewHabitName] = useState('')
  const [newHabitIcon, setNewHabitIcon] = useState('✨')
  const [editHabitName, setEditHabitName] = useState('')
  const [editHabitIcon, setEditHabitIcon] = useState('')
  const [showCompletionCelebration, setShowCompletionCelebration] =
    useState(false)
  const [celebrationKey, setCelebrationKey] = useState(0)
  const [closingModal, setClosingModal] = useState(null)
  const celebrationTimeoutRef = useRef(null)
  const modalCloseTimeoutRef = useRef(null)
  const backgroundRequestRef = useRef(0)
  const initialBackgroundRef = useRef(selectedBackground)

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

  useEffect(() => {
    const initialBackground = initialBackgroundRef.current

    if (initialBackground === 'original') {
      return undefined
    }

    const option = backgroundOptions.find(
      (background) => background.id === initialBackground,
    )
    const image = new Image()

    image.onload = () => {
      Promise.resolve(image.decode?.()).catch(() => {}).finally(() => {
        setLoadedBackgrounds((current) =>
          new Set(current).add(initialBackground),
        )
        setBackgroundLayers((current) => ({
          current: initialBackground,
          previous: current.current,
        }))
      })
    }
    image.onerror = () => {
      setSelectedBackground('original')
      localStorage.setItem(BACKGROUND_STORAGE_KEY, 'original')
    }
    image.src = option.image

    return () => {
      image.onload = null
      image.onerror = null
    }
  }, [])

  useEffect(() => {
    return () => {
      clearTimeout(celebrationTimeoutRef.current)
      clearTimeout(modalCloseTimeoutRef.current)
    }
  }, [])

  const completedCount = useMemo(
    () => habits.filter((habit) => habit.completed).length,
    [habits],
  )

  const progress =
    habits.length === 0
      ? 0
      : Math.round((completedCount / habits.length) * 100)

  const [animatedProgress, setAnimatedProgress] = useState(progress)
  const animatedProgressRef = useRef(progress)

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches

    if (prefersReducedMotion) {
      animatedProgressRef.current = progress
      setAnimatedProgress(progress)
      return undefined
    }

    const startProgress = animatedProgressRef.current

    if (startProgress === progress) {
      return undefined
    }

    const duration = 700
    const progressDifference = progress - startProgress
    let animationFrameId
    let startTime

    function animate(timestamp) {
      startTime ??= timestamp

      const elapsed = timestamp - startTime
      const timeProgress = Math.min(elapsed / duration, 1)
      const easedProgress = 1 - Math.pow(1 - timeProgress, 3)
      const nextProgress =
        startProgress + progressDifference * easedProgress

      animatedProgressRef.current = nextProgress
      setAnimatedProgress(nextProgress)

      if (timeProgress < 1) {
        animationFrameId = requestAnimationFrame(animate)
      }
    }

    animationFrameId = requestAnimationFrame(animate)

    return () => cancelAnimationFrame(animationFrameId)
  }, [progress])

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
    const wasAllComplete =
      habits.length > 0 && habits.every((habit) => habit.completed)
    const updatedHabits = habits.map((habit) =>
      habit.id === id
        ? {
            ...habit,
            completed: !habit.completed,
          }
        : habit,
    )
    const isNowAllComplete =
      updatedHabits.length > 0 &&
      updatedHabits.every((habit) => habit.completed)

    if (!wasAllComplete && isNowAllComplete) {
      clearTimeout(celebrationTimeoutRef.current)
      setCelebrationKey((currentKey) => currentKey + 1)
      setShowCompletionCelebration(true)

      const prefersReducedMotion = window.matchMedia(
        '(prefers-reduced-motion: reduce)',
      ).matches

      celebrationTimeoutRef.current = setTimeout(
        () => setShowCompletionCelebration(false),
        prefersReducedMotion ? 750 : 1450,
      )
    }

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

  function requestModalClose(modalType) {
    if (modalCloseTimeoutRef.current !== null) {
      return
    }

    setClosingModal(modalType)

    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches

    modalCloseTimeoutRef.current = setTimeout(
      () => {
        if (modalType === 'add') {
          setIsAddOpen(false)
        } else if (modalType === 'manage') {
          setIsManageOpen(false)
        } else if (modalType === 'history') {
          setIsHistoryOpen(false)
        } else if (modalType === 'edit') {
          setEditingHabitId(null)
        } else if (modalType === 'appearance') {
          setIsAppearanceOpen(false)
        }

        modalCloseTimeoutRef.current = null
        setClosingModal(null)
      },
      prefersReducedMotion ? 140 : 360,
    )
  }

  function closeAddHabit() {
    requestModalClose('add')
  }

  function preloadBackgrounds() {
    backgroundOptions.forEach((option) => {
      if (!option.image || loadedBackgrounds.has(option.id)) {
        return
      }

      const image = new Image()
      image.onload = () => {
        Promise.resolve(image.decode?.()).catch(() => {}).finally(() => {
          setLoadedBackgrounds((current) => new Set(current).add(option.id))
        })
      }
      image.src = option.image
    })
  }

  function openAppearance() {
    setIsAppearanceOpen(true)
    preloadBackgrounds()
  }

  function applyBackground(option) {
    const requestId = backgroundRequestRef.current + 1
    backgroundRequestRef.current = requestId

    const commitBackground = () => {
      if (backgroundRequestRef.current !== requestId) return

      setSelectedBackground(option.id)
      localStorage.setItem(BACKGROUND_STORAGE_KEY, option.id)
      setLoadedBackgrounds((current) => new Set(current).add(option.id))
      setBackgroundLayers((current) =>
        current.current === option.id
          ? current
          : { current: option.id, previous: current.current },
      )
    }

    if (!option.image || loadedBackgrounds.has(option.id)) {
      commitBackground()
      return
    }

    const image = new Image()
    image.onload = () =>
      Promise.resolve(image.decode?.()).catch(() => {}).finally(commitBackground)
    image.onerror = () => {
      if (backgroundRequestRef.current !== requestId) return
      applyBackground(backgroundOptions[0])
    }
    image.src = option.image
  }

  function getBackgroundStyle(backgroundId) {
    const option = backgroundOptions.find(
      (background) => background.id === backgroundId,
    )

    return option?.image
      ? { backgroundImage: `url(${option.image})` }
      : undefined
  }

  function openEditHabit(habit) {
    setEditHabitName(habit.name)
    setEditHabitIcon(habit.icon)
    setEditingHabitId(habit.id)
  }

  function closeEditHabit() {
    requestModalClose('edit')
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
      {backgroundLayers.previous && (
        <div
          className={`app-background ${
            backgroundLayers.previous === 'original' ? 'original' : 'image'
          } app-background-previous`}
          style={getBackgroundStyle(backgroundLayers.previous)}
          aria-hidden="true"
        />
      )}
      <div
        key={backgroundLayers.current}
        className={`app-background ${
          backgroundLayers.current === 'original' ? 'original' : 'image'
        } app-background-current`}
        style={getBackgroundStyle(backgroundLayers.current)}
        onAnimationEnd={() =>
          setBackgroundLayers((current) => ({ ...current, previous: null }))
        }
        aria-hidden="true"
      />
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      {showCompletionCelebration && (
        <div
          key={celebrationKey}
          className="completion-celebration"
          aria-hidden="true"
        >
          <div className="completion-badge">
            <svg
              className="completion-check"
              viewBox="0 0 112 112"
              aria-hidden="true"
            >
              <path d="M 25 58 L 47 78 L 88 35" />
            </svg>
          </div>
        </div>
      )}

      <section
        className="dashboard"
        aria-label="Luma habit dashboard"
      >
        <header className="topbar">
          <div>
            <p className="eyebrow">{displayDate}</p>
            <h1>Luma</h1>
          </div>

          <div className="tool-buttons">
            <button
              className="tool-button"
              type="button"
              aria-label="Add habit"
              onClick={openAddHabit}
            >
              <svg
                className="tool-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.65"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M12 5.5v13M5.5 12h13" />
              </svg>
            </button>

            <button
              className="tool-button"
              type="button"
              aria-label="Customize background"
              onClick={openAppearance}
            >
              <svg
                className="tool-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.65"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M5.5 16.5H5A2.5 2.5 0 0 1 2.5 14V5A2.5 2.5 0 0 1 5 2.5h9A2.5 2.5 0 0 1 16.5 5v.5" />
                <rect x="6.5" y="6.5" width="15" height="15" rx="2.8" />
                <circle cx="17.2" cy="10.8" r="1.35" />
                <path d="m8.8 18.1 3.55-3.75 2.35 2.25 1.55-1.5 3.05 3" />
              </svg>
            </button>
          </div>
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
              '--progress': `${animatedProgress * 3.6}deg`,
            }}
          >
            <div className="progress-ring-inner">
              <strong>{Math.round(animatedProgress)}%</strong>
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

      </section>

      {isAppearanceOpen && (
        <div
          className={`modal-backdrop ${
            closingModal === 'appearance' ? 'modal-closing' : ''
          }`}
          role="presentation"
          onMouseDown={() => requestModalClose('appearance')}
        >
          <section
            className={`add-modal appearance-modal ${
              closingModal === 'appearance' ? 'modal-closing' : ''
            }`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="appearance-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <p className="section-label">Personalize</p>
                <h2 id="appearance-title">Appearance</h2>
              </div>
              <button
                className="close-button"
                type="button"
                aria-label="Close"
                onClick={() => requestModalClose('appearance')}
              >
                ×
              </button>
            </div>

            <div className="background-picker-heading">
              <p className="section-label">Background</p>
              <h3>Choose your atmosphere</h3>
            </div>
            <div className="background-options">
              {backgroundOptions.map((option) => (
                <button
                  key={option.id}
                  className={`background-option ${
                    selectedBackground === option.id ? 'selected' : ''
                  }`}
                  type="button"
                  aria-pressed={selectedBackground === option.id}
                  onClick={() => applyBackground(option)}
                >
                  <span
                    className={`background-thumbnail ${
                      option.type === 'gradient' ? 'original' : ''
                    } ${loadedBackgrounds.has(option.id) ? 'loaded' : ''}`}
                  >
                    {option.image && (
                      <img src={option.image} alt="" onLoad={() =>
                        setLoadedBackgrounds((current) =>
                          new Set(current).add(option.id),
                        )
                      } />
                    )}
                    {selectedBackground === option.id && (
                      <span className="background-check" aria-hidden="true">✓</span>
                    )}
                  </span>
                  <strong>{option.name}</strong>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}

      {isAddOpen && (
        <div
          className={`modal-backdrop ${
            closingModal === 'add' ? 'modal-closing' : ''
          }`}
          role="presentation"
          onMouseDown={closeAddHabit}
        >
          <section
            className={`add-modal ${
              closingModal === 'add' ? 'modal-closing' : ''
            }`}
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
          className={`modal-backdrop ${
            closingModal === 'manage' ? 'modal-closing' : ''
          }`}
          role="presentation"
          onMouseDown={() => requestModalClose('manage')}
        >
          <section
            className={`add-modal manage-modal ${
              closingModal === 'manage' ? 'modal-closing' : ''
            }`}
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
                onClick={() => requestModalClose('manage')}
              >
                ×
              </button>
            </div>

            <div className="manage-habit-list manage-list-animate">
              {habitDefinitions.map((habit, index) => (
                <div
                  className="manage-habit-item"
                  key={habit.id}
                  style={{
                    '--habit-delay': `${Math.min(index * 45, 320)}ms`,
                  }}
                >
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
          className={`modal-backdrop ${
            closingModal === 'history' ? 'modal-closing' : ''
          }`}
          role="presentation"
          onMouseDown={() => requestModalClose('history')}
        >
          <section
            className={`add-modal history-modal ${
              closingModal === 'history' ? 'modal-closing' : ''
            }`}
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
                onClick={() => requestModalClose('history')}
              >
                ×
              </button>
            </div>

            <div className="history-stats">
              <div
                className="history-stat-card"
                style={{ '--stagger-delay': '0ms' }}
              >
                <span>Current streak</span>
                <strong>{historySummary.currentStreak}</strong>
                <small>days</small>
              </div>
              <div
                className="history-stat-card"
                style={{ '--stagger-delay': '50ms' }}
              >
                <span>Best streak</span>
                <strong>{historySummary.bestStreak}</strong>
                <small>days</small>
              </div>
              <div
                className="history-stat-card"
                style={{ '--stagger-delay': '100ms' }}
              >
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
                {historySummary.heatmapDays.map((day, index) => {
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
                      style={{ '--stagger-delay': `${index * 12}ms` }}
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
          className={`modal-backdrop edit-modal-backdrop ${
            closingModal === 'edit' ? 'modal-closing' : ''
          }`}
          role="presentation"
          onMouseDown={closeEditHabit}
        >
          <section
            className={`add-modal edit-modal ${
              closingModal === 'edit' ? 'modal-closing' : ''
            }`}
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
