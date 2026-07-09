"use client";

import React, { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import {
  Plus,
  Trash,
  Edit,
  Check,
  Calendar,
  Notes,
  Settings,
  Sync,
  Search,
  ChevronDown,
  ChevronRight,
  Menu,
  Close,
  Folder,
  Info,
} from "./Icons";

// Google Tasks Resource Interfaces
interface GoogleTaskList {
  id: string;
  title: string;
  updated?: string;
  selfLink?: string;
}

interface GoogleTask {
  id: string;
  title: string;
  notes?: string;
  status: "needsAction" | "completed";
  due?: string;
  completed?: string;
  parent?: string;
  position?: string;
  deleted?: boolean;
  hidden?: boolean;
}

// Default mock data to populate local storage when empty
const DEFAULT_LISTS: GoogleTaskList[] = [
  { id: "list-projects", title: "🎯 Metas de Projetos" },
  { id: "list-dev", title: "💻 Desenvolvimento Web" },
  { id: "list-daily", title: "🏠 Tarefas Diárias" },
];

const DEFAULT_TASKS: GoogleTask[] = [
  {
    id: "task-p1",
    title: "Configurar repositório Git e CI/CD",
    status: "completed",
    notes: "Utilizar GitHub Actions e configurar branch protection.",
    completed: new Date().toISOString(),
    due: new Date().toISOString().split("T")[0] + "T00:00:00.000Z",
  },
  {
    id: "task-p2",
    title: "Integrar com a Google Tasks API",
    status: "needsAction",
    notes: "Conectar OAuth2 usando a base URL https://tasks.googleapis.com\nConfigurar credenciais no arquivo .env do projeto.",
    due: new Date(Date.now() + 86400000).toISOString().split("T")[0] + "T00:00:00.000Z",
  },
  {
    id: "task-p3",
    title: "Desenhar interface premium com modo escuro",
    status: "needsAction",
    notes: "Usar gradientes elegantes, glassmorphism e micro-interações.",
  },
  {
    id: "task-d1",
    title: "Estudar novos recursos do Next.js 16",
    status: "completed",
    notes: "Analisar as APIs assíncronas do App Router como cookies() e headers().",
    completed: new Date().toISOString(),
  },
  {
    id: "task-d2",
    title: "Criar componentes de UI reutilizáveis",
    status: "completed",
    notes: "Desenhar botões, inputs, modais e layouts responsivos.",
    completed: new Date().toISOString(),
  },
  {
    id: "task-d3",
    title: "Escrever testes de integração e validação",
    status: "needsAction",
    notes: "Garantir cobertura das rotas críticas e do fluxo de sincronização.",
    due: new Date(Date.now() + 172800000).toISOString().split("T")[0] + "T00:00:00.000Z",
  },
  {
    id: "task-y1",
    title: "Comprar café em grãos",
    status: "needsAction",
    notes: "Sem açúcar, torra média, preferencialmente blend especial.",
  },
  {
    id: "task-y2",
    title: "Ir à academia treinar pernas",
    status: "needsAction",
    notes: "Foco em agachamento livre. Beber 2L de água.",
    due: new Date().toISOString().split("T")[0] + "T00:00:00.000Z",
  },
  {
    id: "task-y3",
    title: "Ler 10 páginas de um livro técnico",
    status: "completed",
    notes: "Leitura atual: Designing Data-Intensive Applications.",
    completed: new Date().toISOString(),
  },
];

export default function TaskApp() {
  // App States
  const [taskLists, setTaskLists] = useState<GoogleTaskList[]>([]);
  const [tasks, setTasks] = useState<GoogleTask[]>([]);
  const [selectedListId, setSelectedListId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedTask, setSelectedTask] = useState<GoogleTask | null>(null);

  // Sync Mode States
  const [isServerSync, setIsServerSync] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "error" | "success">("idle");
  const [syncErrorMsg, setSyncErrorMsg] = useState<string>("");
  const [user, setUser] = useState<any>(null);
  const supabase = createClient();

  // UI States
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isAddingList, setIsAddingList] = useState<boolean>(false);
  const [newListTitle, setNewListTitle] = useState<string>("");
  const [newTaskTitle, setNewTaskTitle] = useState<string>("");
  const [isEditingListTitle, setIsEditingListTitle] = useState<boolean>(false);
  const [editingListTitleText, setEditingListTitleText] = useState<string>("");
  const [collapsedCompleted, setCollapsedCompleted] = useState<boolean>(false);

  // Subtask UI expansion state
  const [expandedParentTasks, setExpandedParentTasks] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // Load Dark Mode from localStorage
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "light") {
      setIsDarkMode(false);
      document.documentElement.classList.remove("dark");
    } else {
      setIsDarkMode(true);
      document.documentElement.classList.add("dark");
    }

    // Monitor Supabase auth changes
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      loadAllData();
    });

    // Load initial data
    loadAllData();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Fetch lists and tasks via API proxy or fallback to mock
  const loadAllData = async () => {
    setSyncStatus("syncing");
    setSyncErrorMsg("");

    try {
      const res = await fetch("/api/tasks");
      if (!res.ok) {
        throw new Error("Falha na chamada da API local");
      }
      
      const data = await res.json();

      if (data.user) {
        setUser(data.user);
      }
      
      if (data.demoMode) {
        // Fallback to local storage mock data
        setIsServerSync(false);
        loadMockData();
        setSyncStatus("idle");
      } else {
        // Connected directly to Google Tasks on Server Side!
        setIsServerSync(true);
        const lists = data.items || [];
        setTaskLists(lists);

        if (lists.length > 0) {
          let activeId = selectedListId;
          if (!activeId || !lists.some((l: any) => l.id === activeId)) {
            activeId = lists[0].id;
            setSelectedListId(activeId);
          }
          await fetchTasksForList(activeId, true);
        } else {
          setTasks([]);
        }
        setSyncStatus("success");
      }
    } catch (err: any) {
      console.error("Failed to load lists:", err);
      setIsServerSync(false);
      loadMockData();
      setSyncStatus("error");
      setSyncErrorMsg("Sem conexão com o servidor. Rodando no modo Local.");
    }
  };

  const handleGoogleLogin = async () => {
    setSyncStatus("syncing");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
        scopes: 'https://www.googleapis.com/auth/tasks',
      },
    });

    if (error) {
      console.error("Erro no login com o Google:", error.message);
      setSyncStatus("error");
      setSyncErrorMsg(`Erro no login: ${error.message}`);
    }
  };

  const handleSignOut = async () => {
    setSyncStatus("syncing");
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Erro ao sair:", error.message);
      setSyncStatus("error");
      setSyncErrorMsg(`Erro ao sair: ${error.message}`);
    } else {
      setUser(null);
      setIsServerSync(false);
      loadMockData();
      setSyncStatus("idle");
    }
  };

  const fetchTasksForList = async (listId: string, serverSyncMode: boolean) => {
    if (serverSyncMode) {
      try {
        const res = await fetch(`/api/tasks?listId=${listId}`);
        if (!res.ok) throw new Error("Erro ao buscar tarefas do servidor");
        const data = await res.json();
        setTasks(data.items || []);
      } catch (err) {
        console.error("Error fetching tasks from server API:", err);
        throw err;
      }
    }
  };

  const loadMockData = () => {
    const savedLists = localStorage.getItem("mock_task_lists");
    const savedTasks = localStorage.getItem("mock_tasks");

    if (savedLists && savedTasks) {
      const lists = JSON.parse(savedLists);
      setTaskLists(lists);
      const parsedTasks = JSON.parse(savedTasks);
      setTasks(parsedTasks);

      if (lists.length > 0) {
        if (!selectedListId || !lists.some((l: any) => l.id === selectedListId)) {
          setSelectedListId(lists[0].id);
        }
      }
    } else {
      localStorage.setItem("mock_task_lists", JSON.stringify(DEFAULT_LISTS));
      localStorage.setItem("mock_tasks", JSON.stringify(DEFAULT_TASKS));
      setTaskLists(DEFAULT_LISTS);
      setTasks(DEFAULT_TASKS);
      setSelectedListId(DEFAULT_LISTS[0].id);
    }
  };

  const saveMockData = (updatedLists: GoogleTaskList[], updatedTasks: GoogleTask[]) => {
    localStorage.setItem("mock_task_lists", JSON.stringify(updatedLists));
    localStorage.setItem("mock_tasks", JSON.stringify(updatedTasks));
  };

  // Change Active List
  const handleListChange = async (listId: string) => {
    setSelectedListId(listId);
    setSelectedTask(null);
    if (isServerSync) {
      setSyncStatus("syncing");
      try {
        await fetchTasksForList(listId, true);
        setSyncStatus("success");
      } catch (err) {
        setSyncStatus("error");
        setSyncErrorMsg("Erro ao trocar de lista.");
      }
    }
  };

  // Theme Toggle
  const toggleTheme = () => {
    const nextTheme = !isDarkMode;
    setIsDarkMode(nextTheme);
    if (nextTheme) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  };

  // Create Task List
  const handleAddTaskList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListTitle.trim()) return;

    if (isServerSync) {
      setSyncStatus("syncing");
      try {
        const res = await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "list", title: newListTitle }),
        });
        if (!res.ok) throw new Error();
        const newList = await res.json();
        const updatedLists = [...taskLists, newList];
        setTaskLists(updatedLists);
        setSelectedListId(newList.id);
        setTasks([]);
        setSyncStatus("success");
      } catch (err) {
        setSyncStatus("error");
        setSyncErrorMsg("Erro ao criar lista.");
      }
    } else {
      // Mock Mode
      const newListId = `list-${Date.now()}`;
      const newList: GoogleTaskList = { id: newListId, title: newListTitle };
      const updatedLists = [...taskLists, newList];
      setTaskLists(updatedLists);
      saveMockData(updatedLists, tasks);
      setSelectedListId(newListId);
    }

    setNewListTitle("");
    setIsAddingList(false);
  };

  // Rename Task List
  const handleRenameTaskList = async () => {
    if (!editingListTitleText.trim() || !selectedListId) return;

    if (isServerSync) {
      setSyncStatus("syncing");
      try {
        const res = await fetch("/api/tasks", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "list", id: selectedListId, title: editingListTitleText }),
        });
        if (!res.ok) throw new Error();
        setTaskLists(
          taskLists.map((l) => (l.id === selectedListId ? { ...l, title: editingListTitleText } : l))
        );
        setSyncStatus("success");
      } catch (err) {
        setSyncStatus("error");
      }
    } else {
      // Mock Mode
      const updatedLists = taskLists.map((l) =>
        l.id === selectedListId ? { ...l, title: editingListTitleText } : l
      );
      setTaskLists(updatedLists);
      saveMockData(updatedLists, tasks);
    }
    setIsEditingListTitle(false);
  };

  // Delete Task List
  const handleDeleteTaskList = async (listId: string) => {
    if (taskLists.length <= 1) {
      alert("Você deve manter pelo menos uma lista de tarefas.");
      return;
    }
    if (!confirm("Tem certeza que deseja excluir esta lista e todas as suas tarefas?")) {
      return;
    }

    if (isServerSync) {
      setSyncStatus("syncing");
      try {
        const res = await fetch(`/api/tasks?type=list&id=${listId}`, { method: "DELETE" });
        if (!res.ok) throw new Error();
        const remainingLists = taskLists.filter((l) => l.id !== listId);
        setTaskLists(remainingLists);
        const nextListId = remainingLists[0].id;
        setSelectedListId(nextListId);
        await fetchTasksForList(nextListId, true);
        setSyncStatus("success");
      } catch (err) {
        setSyncStatus("error");
      }
    } else {
      // Mock Mode
      const remainingLists = taskLists.filter((l) => l.id !== listId);
      const remainingTasks = tasks.filter((t) => getTaskListIdForTask(t) !== listId);

      setTaskLists(remainingLists);
      setTasks(remainingTasks);
      saveMockData(remainingLists, remainingTasks);
      setSelectedListId(remainingLists[0].id);
    }
    setSelectedTask(null);
  };

  // Helper to resolve list ID for a task (handles mock list mapping)
  const getTaskListIdForTask = (task: GoogleTask): string => {
    if ((task as any).listId) return (task as any).listId;
    if (task.id.startsWith("task-p")) return "list-projects";
    if (task.id.startsWith("task-d")) return "list-dev";
    if (task.id.startsWith("task-y")) return "list-daily";
    return selectedListId;
  };

  // Filter tasks to show only those belonging to the current selected list
  const getFilteredTasksForSelectedList = (): GoogleTask[] => {
    if (isServerSync) {
      return tasks;
    } else {
      return tasks.filter((t) => getTaskListIdForTask(t) === selectedListId);
    }
  };

  // Create Task
  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    if (isServerSync) {
      setSyncStatus("syncing");
      try {
        const res = await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "task", listId: selectedListId, title: newTaskTitle }),
        });
        if (!res.ok) throw new Error();
        const createdTask = await res.json();
        setTasks([createdTask, ...tasks]);
        setSyncStatus("success");
      } catch (err) {
        setSyncStatus("error");
      }
    } else {
      // Mock Mode
      const newTaskObj: GoogleTask = {
        id: `task-${Date.now()}`,
        title: newTaskTitle,
        status: "needsAction",
      };
      (newTaskObj as any).listId = selectedListId;
      const updatedTasks = [newTaskObj, ...tasks];
      setTasks(updatedTasks);
      saveMockData(taskLists, updatedTasks);
    }
    setNewTaskTitle("");
  };

  // Toggle Task Status (Complete/Incomplete)
  const handleToggleTaskStatus = async (task: GoogleTask) => {
    const newStatus: "needsAction" | "completed" = task.status === "completed" ? "needsAction" : "completed";
    const completedDate = newStatus === "completed" ? new Date().toISOString() : undefined;

    // Optimistic Update
    const updatedTasks = tasks.map((t) =>
      t.id === task.id ? { ...t, status: newStatus, completed: completedDate } : t
    );
    setTasks(updatedTasks);

    if (selectedTask?.id === task.id) {
      setSelectedTask({ ...selectedTask, status: newStatus, completed: completedDate });
    }

    if (isServerSync) {
      setSyncStatus("syncing");
      try {
        const res = await fetch("/api/tasks", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "task",
            listId: selectedListId,
            id: task.id,
            task: { ...task, status: newStatus, completed: completedDate },
          }),
        });
        if (!res.ok) throw new Error();
        setSyncStatus("success");
      } catch (err) {
        // Rollback
        setTasks(tasks);
        setSyncStatus("error");
      }
    } else {
      saveMockData(taskLists, updatedTasks);
    }
  };

  // Create Subtask
  const handleAddSubtask = async (parentId: string, title: string) => {
    if (!title.trim()) return;

    if (isServerSync) {
      setSyncStatus("syncing");
      try {
        const res = await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "task",
            listId: selectedListId,
            title,
            parent: parentId,
          }),
        });
        if (!res.ok) throw new Error();
        const createdSubtask = await res.json();
        setTasks([...tasks, createdSubtask]);
        setExpandedParentTasks((prev) => ({ ...prev, [parentId]: true }));
        setSyncStatus("success");
      } catch (err) {
        setSyncStatus("error");
      }
    } else {
      // Mock Mode
      const newSubtaskObj: GoogleTask = {
        id: `task-${Date.now()}`,
        title,
        status: "needsAction",
        parent: parentId,
      };
      (newSubtaskObj as any).listId = selectedListId;
      const updatedTasks = [...tasks, newSubtaskObj];
      setTasks(updatedTasks);
      saveMockData(taskLists, updatedTasks);
      setExpandedParentTasks((prev) => ({ ...prev, [parentId]: true }));
    }
  };

  // Update Task details (Title, Notes, Due Date, etc.)
  const handleUpdateTaskDetails = async (updatedTask: GoogleTask) => {
    const movedToListId = (updatedTask as any).listId;
    const isMoved = movedToListId && movedToListId !== selectedListId;

    let updatedTasksList = tasks;
    if (isMoved && !isServerSync) {
      updatedTasksList = tasks.map((t) => (t.id === updatedTask.id ? updatedTask : t));
    } else if (isMoved && isServerSync) {
      setSyncStatus("syncing");
      try {
        const res = await fetch("/api/tasks", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "task",
            listId: selectedListId,
            id: updatedTask.id,
            destinationListId: movedToListId,
          }),
        });
        if (!res.ok) throw new Error();
        updatedTasksList = tasks.filter((t) => t.id !== updatedTask.id);
        setSelectedTask(null);
        setSyncStatus("success");
      } catch (err) {
        console.error("Failed to move Google Task:", err);
        setSyncStatus("error");
        return;
      }
    } else {
      updatedTasksList = tasks.map((t) => (t.id === updatedTask.id ? updatedTask : t));
    }

    setTasks(updatedTasksList);
    if (!isMoved) {
      setSelectedTask(updatedTask);
    }

    if (isServerSync && !isMoved) {
      setSyncStatus("syncing");
      try {
        const res = await fetch("/api/tasks", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "task",
            listId: selectedListId,
            id: updatedTask.id,
            task: updatedTask,
          }),
        });
        if (!res.ok) throw new Error();
        setSyncStatus("success");
      } catch (err) {
        setSyncStatus("error");
      }
    } else if (!isServerSync) {
      saveMockData(taskLists, updatedTasksList);
    }
  };

  // Delete Task
  const handleDeleteTask = async (taskId: string) => {
    if (!confirm("Tem certeza que deseja excluir esta tarefa?")) return;

    if (isServerSync) {
      setSyncStatus("syncing");
      try {
        const res = await fetch(`/api/tasks?type=task&listId=${selectedListId}&id=${taskId}`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error();
        setTasks(tasks.filter((t) => t.id !== taskId));
        setSelectedTask(null);
        setSyncStatus("success");
      } catch (err) {
        setSyncStatus("error");
      }
    } else {
      const remainingTasks = tasks.filter((t) => t.id !== taskId && t.parent !== taskId);
      setTasks(remainingTasks);
      saveMockData(taskLists, remainingTasks);
      setSelectedTask(null);
    }
  };

  // Clear Completed Tasks
  const handleClearCompleted = async () => {
    if (!confirm("Deseja apagar todas as tarefas concluídas nesta lista?")) return;

    if (isServerSync) {
      setSyncStatus("syncing");
      try {
        const res = await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "clear", listId: selectedListId }),
        });
        if (!res.ok) throw new Error();
        await fetchTasksForList(selectedListId, true);
        setSyncStatus("success");
      } catch (err) {
        setSyncStatus("error");
      }
    } else {
      const listTasks = getFilteredTasksForSelectedList();
      const completedIds = listTasks.filter((t) => t.status === "completed").map((t) => t.id);
      const remainingTasks = tasks.filter(
        (t) => !completedIds.includes(t.id) && !completedIds.includes(t.parent || "")
      );
      setTasks(remainingTasks);
      saveMockData(taskLists, remainingTasks);
    }
    setSelectedTask(null);
  };

  const activeListTasks = getFilteredTasksForSelectedList();
  
  const searchedTasks = activeListTasks.filter((task) => {
    if (!searchQuery) return true;
    const titleMatch = task.title.toLowerCase().includes(searchQuery.toLowerCase());
    const notesMatch = task.notes?.toLowerCase().includes(searchQuery.toLowerCase()) || false;
    return titleMatch || notesMatch;
  });

  const parentTasks = searchedTasks.filter((t) => !t.parent);
  const subTasks = searchedTasks.filter((t) => t.parent);

  const getSubtasksForParent = (parentId: string) => {
    return subTasks.filter((st) => st.parent === parentId);
  };

  const pendingParentTasks = parentTasks.filter((t) => t.status === "needsAction");
  const completedParentTasks = parentTasks.filter((t) => t.status === "completed");

  const currentList = taskLists.find((l) => l.id === selectedListId);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-zinc-50 font-sans text-zinc-950 transition-colors duration-300 dark:bg-zinc-950 dark:text-zinc-50">
      
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-zinc-950/60 backdrop-blur-sm lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* LEFT SIDEBAR */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-72 flex-col border-r border-zinc-200 bg-white/80 p-6 backdrop-blur-md transition-transform duration-300 dark:border-zinc-800 dark:bg-zinc-900/80 lg:static lg:translate-x-0 ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20">
              <Check size={20} className="stroke-[3]" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-zinc-900 to-zinc-600 bg-clip-text text-transparent dark:from-zinc-50 dark:to-zinc-400">
                Tasky
              </h1>
              <span className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500">
                Google Tasks Client
              </span>
            </div>
          </div>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-950 dark:hover:bg-zinc-800 dark:hover:text-zinc-50 lg:hidden"
          >
            <Close size={18} />
          </button>
        </div>

        <div className="mb-6 rounded-xl border border-zinc-100 bg-zinc-50/50 p-3.5 dark:border-zinc-800 dark:bg-zinc-900/50">
          {user ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2.5">
                {user.user_metadata?.avatar_url ? (
                  <img
                    src={user.user_metadata.avatar_url}
                    alt={user.user_metadata.full_name || "Usuário"}
                    className="h-8 w-8 rounded-full border border-zinc-200 dark:border-zinc-700"
                  />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                    {(user.user_metadata?.full_name || user.email || "U").substring(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h4 className="truncate text-xs font-bold text-zinc-950 dark:text-zinc-50">
                    {user.user_metadata?.full_name || user.email}
                  </h4>
                  <p className="truncate text-[10px] text-zinc-400">
                    {isServerSync ? "Sincronizado com Google Tasks" : "Sem acesso ao Google Tasks"}
                  </p>
                </div>
              </div>

              {!isServerSync && (
                <button
                  onClick={handleGoogleLogin}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 py-1.5 text-xs font-semibold text-white shadow-sm hover:from-blue-500 hover:to-indigo-500 transition-all cursor-pointer"
                >
                  Vincular Google Tasks
                </button>
              )}

              <button
                onClick={handleSignOut}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900 transition-all cursor-pointer"
              >
                Sair da Conta
              </button>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                  Conexão
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-orange-400" />
                  <span className="text-xs font-semibold">Modo Local (Demo)</span>
                </div>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                Entre com sua conta Google para sincronizar suas tarefas diretamente com o Google Tasks.
              </p>
              <button
                onClick={handleGoogleLogin}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 py-2 text-xs font-semibold text-white shadow-sm hover:from-blue-500 hover:to-indigo-500 transition-all cursor-pointer"
              >
                Entrar com o Google
              </button>
            </div>
          )}
        </div>

        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
            Minhas Listas
          </span>
          <button
            onClick={() => setIsAddingList(true)}
            className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-950 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
            title="Nova Lista"
          >
            <Plus size={16} />
          </button>
        </div>

        {isAddingList && (
          <form onSubmit={handleAddTaskList} className="mb-4">
            <input
              autoFocus
              type="text"
              placeholder="Nome da lista..."
              value={newListTitle}
              onChange={(e) => setNewListTitle(e.target.value)}
              className="w-full rounded-lg border border-blue-500 bg-zinc-50 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-500 dark:bg-zinc-800"
            />
            <div className="mt-2 flex justify-end gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setIsAddingList(false);
                  setNewListTitle("");
                }}
                className="rounded-md px-2.5 py-1 text-xs font-medium text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-md bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-500"
              >
                Criar
              </button>
            </div>
          </form>
        )}

        <div className="flex-1 overflow-y-auto space-y-1 pr-1">
          {taskLists.map((list) => {
            const isActive = list.id === selectedListId;
            return (
              <button
                key={list.id}
                onClick={() => handleListChange(list.id)}
                className={`group flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-left text-sm font-medium transition-all ${
                  isActive
                    ? "bg-zinc-100 text-blue-600 dark:bg-zinc-800/80 dark:text-blue-400"
                    : "text-zinc-600 hover:bg-zinc-55 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/50 dark:hover:text-zinc-200"
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <Folder
                    size={16}
                    className={isActive ? "text-blue-500" : "text-zinc-400 dark:text-zinc-500"}
                  />
                  <span className="truncate">{list.title}</span>
                </div>
                {taskLists.length > 1 && (
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteTaskList(list.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-zinc-200 hover:text-red-650 dark:hover:bg-zinc-700/50 dark:hover:text-red-400 transition-opacity"
                    title="Excluir lista"
                  >
                    <Trash size={14} />
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-auto border-t border-zinc-100 pt-4 dark:border-zinc-800 flex justify-between items-center">
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center gap-2 rounded-lg p-2 text-sm font-medium text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/50 dark:hover:text-zinc-200"
          >
            <Settings size={18} />
            <span>Configurações .env</span>
          </button>
          <button
            onClick={toggleTheme}
            className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-800/50"
            title="Alternar Tema"
          >
            {isDarkMode ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="4"/>
                <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41m12.72-12.72l-1.41 1.41"/>
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
              </svg>
            )}
          </button>
        </div>
      </aside>

      {/* MIDDLE PANEL */}
      <main className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-zinc-200 bg-white/50 px-6 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 lg:hidden"
            >
              <Menu size={20} />
            </button>
            
            <div className="flex items-center gap-2">
              {isEditingListTitle ? (
                <input
                  autoFocus
                  type="text"
                  value={editingListTitleText}
                  onChange={(e) => setEditingListTitleText(e.target.value)}
                  onBlur={handleRenameTaskList}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRenameTaskList();
                    if (e.key === "Escape") setIsEditingListTitle(false);
                  }}
                  className="rounded border border-blue-500 bg-transparent px-2 py-0.5 text-lg font-bold text-zinc-900 outline-none dark:text-zinc-50"
                />
              ) : (
                <div className="flex items-center gap-2 group">
                  <h2 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                    {currentList?.title || "Sem lista"}
                  </h2>
                  <button
                    onClick={() => {
                      setEditingListTitleText(currentList?.title || "");
                      setIsEditingListTitle(true);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300 transition-opacity"
                    title="Editar título"
                  >
                    <Edit size={14} />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative hidden sm:block">
              <span className="absolute inset-y-0 left-3 flex items-center text-zinc-400">
                <Search size={15} />
              </span>
              <input
                type="text"
                placeholder="Buscar tarefas..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-48 rounded-full border border-zinc-200 bg-zinc-50/50 py-1.5 pl-9 pr-4 text-xs outline-none transition-all focus:w-64 focus:border-blue-500 focus:bg-white dark:border-zinc-800 dark:bg-zinc-900/50 dark:focus:bg-zinc-950"
              />
            </div>

            <button
              onClick={() => loadAllData()}
              className={`rounded-lg p-2 text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 ${
                syncStatus === "syncing" ? "animate-spin text-blue-500" : ""
              }`}
              title="Sincronizar tarefas"
              disabled={syncStatus === "syncing"}
            >
              <Sync size={18} />
            </button>

            {activeListTasks.some((t) => t.status === "completed") && (
              <button
                onClick={handleClearCompleted}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-650 hover:bg-zinc-50 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
              >
                Limpar concluídas
              </button>
            )}
          </div>
        </header>

        {syncStatus === "error" && syncErrorMsg && (
          <div className="flex items-center justify-between bg-red-50 px-6 py-2 text-xs font-medium text-red-700 dark:bg-red-950/30 dark:text-red-400">
            <div className="flex items-center gap-2">
              <Info size={14} />
              <span>{syncErrorMsg}</span>
            </div>
            <button
              onClick={() => setSyncErrorMsg("")}
              className="text-red-500 hover:text-red-700 dark:hover:text-red-355"
            >
              Ok
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-6 py-8">
          <div className="mx-auto max-w-2xl space-y-6">
            
            <form
              onSubmit={handleAddTask}
              className="flex items-center gap-3 rounded-2xl border border-zinc-200/60 bg-white/70 p-3 shadow-sm shadow-zinc-100/50 backdrop-blur-md focus-within:border-blue-500 dark:border-zinc-800/80 dark:bg-zinc-900/60 dark:shadow-none"
            >
              <div className="flex h-6 w-6 items-center justify-center rounded-md border border-zinc-300 dark:border-zinc-700">
                <Plus size={14} className="text-zinc-400" />
              </div>
              <input
                type="text"
                placeholder="Adicionar uma tarefa..."
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                className="flex-1 bg-transparent text-sm font-medium outline-none placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
              />
              <button
                type="submit"
                disabled={!newTaskTitle.trim()}
                className="rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm shadow-blue-500/10 hover:bg-blue-500 disabled:bg-zinc-200 disabled:text-zinc-400 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-650"
              >
                Salvar
              </button>
            </form>

            {parentTasks.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-zinc-100 text-zinc-400 dark:bg-zinc-900 dark:text-zinc-600 mb-4">
                  <Check size={40} className="stroke-[1.5]" />
                </div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-50">
                  Tudo pronto por aqui!
                </h3>
                <p className="max-w-xs text-xs text-zinc-500 mt-1.5 leading-relaxed">
                  Não há tarefas {searchQuery ? "que correspondam à busca" : "pendentes nesta lista"}.
                </p>
              </div>
            )}

            {pendingParentTasks.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider pl-1">
                  Tarefas Ativas
                </h3>
                <div className="space-y-1.5">
                  {pendingParentTasks.map((task) => (
                    <TaskItem
                      key={task.id}
                      task={task}
                      subtasks={getSubtasksForParent(task.id)}
                      isSelected={selectedTask?.id === task.id}
                      isExpanded={!!expandedParentTasks[task.id]}
                      onToggle={() => handleToggleTaskStatus(task)}
                      onSelect={() => setSelectedTask(task)}
                      onToggleExpand={() =>
                        setExpandedParentTasks((prev) => ({
                          ...prev,
                          [task.id]: !prev[task.id],
                        }))
                      }
                      onAddSubtask={(title) => handleAddSubtask(task.id, title)}
                      onToggleSubtask={handleToggleTaskStatus}
                      onSelectSubtask={(st) => setSelectedTask(st)}
                    />
                  ))}
                </div>
              </div>
            )}

            {completedParentTasks.length > 0 && (
              <div className="space-y-2 pt-2">
                <button
                  onClick={() => setCollapsedCompleted(!collapsedCompleted)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-300 uppercase tracking-wider pl-1 transition-colors"
                >
                  {collapsedCompleted ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                  <span>Concluídas ({completedParentTasks.length})</span>
                </button>

                {!collapsedCompleted && (
                  <div className="space-y-1.5">
                    {completedParentTasks.map((task) => (
                      <TaskItem
                        key={task.id}
                        task={task}
                        subtasks={getSubtasksForParent(task.id)}
                        isSelected={selectedTask?.id === task.id}
                        isExpanded={!!expandedParentTasks[task.id]}
                        onToggle={() => handleToggleTaskStatus(task)}
                        onSelect={() => setSelectedTask(task)}
                        onToggleExpand={() =>
                          setExpandedParentTasks((prev) => ({
                            ...prev,
                            [task.id]: !prev[task.id],
                          }))
                        }
                        onAddSubtask={(title) => handleAddSubtask(task.id, title)}
                        onToggleSubtask={handleToggleTaskStatus}
                        onSelectSubtask={(st) => setSelectedTask(st)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {selectedTask && (
        <TaskDetailsDrawer
          task={selectedTask}
          lists={taskLists}
          currentListId={selectedListId}
          onClose={() => setSelectedTask(null)}
          onUpdate={handleUpdateTaskDetails}
          onDelete={() => handleDeleteTask(selectedTask.id)}
        />
      )}

      {isSettingsOpen && (
        <SettingsModal onClose={() => setIsSettingsOpen(false)} />
      )}
    </div>
  );
}

// ==========================================
// COMPONENT: TaskItem
// ==========================================
interface TaskItemProps {
  task: GoogleTask;
  subtasks: GoogleTask[];
  isSelected: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  onSelect: () => void;
  onToggleExpand: () => void;
  onAddSubtask: (title: string) => void;
  onToggleSubtask: (subtask: GoogleTask) => void;
  onSelectSubtask: (subtask: GoogleTask) => void;
}

function TaskItem({
  task,
  subtasks,
  isSelected,
  isExpanded,
  onToggle,
  onSelect,
  onToggleExpand,
  onAddSubtask,
  onToggleSubtask,
  onSelectSubtask,
}: TaskItemProps) {
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [isAddingSubtask, setIsAddingSubtask] = useState(false);

  const isCompleted = task.status === "completed";

  const completedSubtasks = subtasks.filter((st) => st.status === "completed");

  const formattedDueDate = task.due
    ? new Date(task.due).toLocaleDateString("pt-BR", {
        day: "numeric",
        month: "short",
        timeZone: "UTC",
      })
    : null;

  const handleSubtaskSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newSubtaskTitle.trim()) {
      onAddSubtask(newSubtaskTitle);
      setNewSubtaskTitle("");
      setIsAddingSubtask(false);
    }
  };

  return (
    <div
      className={`group rounded-xl border border-zinc-200/50 bg-white shadow-sm transition-all hover:shadow-md dark:border-zinc-800/60 dark:bg-zinc-900/60 ${
        isSelected ? "ring-1 ring-blue-500/80 border-transparent" : ""
      }`}
    >
      <div
        onClick={onSelect}
        className="flex cursor-pointer items-start justify-between gap-4 p-4.5"
      >
        <div className="flex flex-1 items-start gap-3 truncate">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all ${
              isCompleted
                ? "bg-blue-600 border-blue-600 text-white"
                : "border-zinc-300 hover:border-blue-500 dark:border-zinc-700"
            }`}
          >
            {isCompleted && <Check size={12} className="stroke-[3]" />}
          </button>

          <div className="flex-1 truncate">
            <span
              className={`text-sm font-semibold transition-all ${
                isCompleted
                  ? "text-zinc-400 line-through dark:text-zinc-500"
                  : "text-zinc-900 dark:text-zinc-50"
              }`}
            >
              {task.title}
            </span>

            {task.notes && (
              <p className="mt-1 text-xs text-zinc-505 dark:text-zinc-400 line-clamp-1">
                {task.notes}
              </p>
            )}

            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              {formattedDueDate && (
                <div
                  className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold tracking-wide ${
                    isCompleted
                      ? "bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500"
                      : new Date(task.due!).getTime() < Date.now() - 86400000
                      ? "bg-red-50 text-red-650 dark:bg-red-950/20 dark:text-red-400"
                      : "bg-blue-50 text-blue-600 dark:bg-blue-950/20 dark:text-blue-400"
                  }`}
                >
                  <Calendar size={10} />
                  <span>{formattedDueDate}</span>
                </div>
              )}

              {subtasks.length > 0 && (
                <div className="flex items-center gap-1 rounded-md bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-650 dark:bg-zinc-800 dark:text-zinc-400">
                  <span>
                    {completedSubtasks.length}/{subtasks.length} Subtarefas
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {subtasks.length > 0 || isSelected ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand();
            }}
            className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-50 hover:text-zinc-700 dark:hover:bg-zinc-800"
          >
            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
        ) : null}
      </div>

      {isExpanded && (
        <div className="border-t border-zinc-100 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/30 space-y-3.5">
          {subtasks.length > 0 && (
            <div className="space-y-2">
              {subtasks.map((st) => {
                const stCompleted = st.status === "completed";
                return (
                  <div
                    key={st.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectSubtask(st);
                    }}
                    className="flex cursor-pointer items-center justify-between gap-3 pl-6"
                  >
                    <div className="flex flex-1 items-center gap-2.5 truncate">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleSubtask(st);
                        }}
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-all ${
                          stCompleted
                            ? "bg-blue-600 border-blue-600 text-white"
                            : "border-zinc-300 hover:border-blue-500 dark:border-zinc-700"
                        }`}
                      >
                        {stCompleted && <Check size={10} className="stroke-[3]" />}
                      </button>
                      <span
                        className={`text-xs transition-all ${
                          stCompleted
                            ? "text-zinc-400 line-through dark:text-zinc-550"
                            : "text-zinc-800 font-medium dark:text-zinc-200"
                        }`}
                      >
                        {st.title}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {isAddingSubtask ? (
            <form onSubmit={handleSubtaskSubmit} className="flex gap-2 pl-6">
              <input
                autoFocus
                type="text"
                placeholder="Nova subtarefa..."
                value={newSubtaskTitle}
                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                className="flex-1 rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-xs outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-950"
              />
              <button
                type="submit"
                className="rounded-md bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-500"
              >
                Adicionar
              </button>
              <button
                type="button"
                onClick={() => setIsAddingSubtask(false)}
                className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900"
              >
                Cancelar
              </button>
            </form>
          ) : (
            <button
              onClick={() => setIsAddingSubtask(true)}
              className="flex items-center gap-1.5 pl-6 text-xs font-semibold text-blue-600 hover:text-blue-550 dark:text-blue-400 dark:hover:text-blue-300"
            >
              <Plus size={12} />
              <span>Adicionar subtarefa</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ==========================================
// COMPONENT: TaskDetailsDrawer
// ==========================================
interface TaskDetailsDrawerProps {
  task: GoogleTask;
  lists: GoogleTaskList[];
  currentListId: string;
  onClose: () => void;
  onUpdate: (task: GoogleTask) => void;
  onDelete: () => void;
}

function TaskDetailsDrawer({
  task,
  lists,
  currentListId,
  onClose,
  onUpdate,
  onDelete,
}: TaskDetailsDrawerProps) {
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes || "");
  const [due, setDue] = useState(task.due ? task.due.split("T")[0] : "");
  const [listId, setListId] = useState(currentListId);

  useEffect(() => {
    setTitle(task.title);
    setNotes(task.notes || "");
    setDue(task.due ? task.due.split("T")[0] : "");
    setListId((task as any).listId || currentListId);
  }, [task, currentListId]);

  const handleSave = () => {
    const updated: GoogleTask = {
      ...task,
      title,
      notes: notes || undefined,
      due: due ? `${due}T00:00:00.000Z` : undefined,
    };
    if (listId !== currentListId) {
      (updated as any).listId = listId;
    }
    onUpdate(updated);
  };

  return (
    <aside className="fixed inset-y-0 right-0 z-30 flex w-full flex-col border-l border-zinc-200 bg-white p-6 shadow-2xl transition-all dark:border-zinc-800 dark:bg-zinc-900/95 sm:w-96">
      <div className="mb-6 flex items-center justify-between">
        <h3 className="text-base font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Detalhes da Tarefa
        </h3>
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-950 dark:hover:bg-zinc-850 dark:hover:text-zinc-50"
        >
          <Close size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-6 pr-1">
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">
            Título
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleSave}
            placeholder="Título da tarefa"
            className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-sm font-semibold outline-none focus:border-blue-500 focus:bg-white dark:border-zinc-800 dark:bg-zinc-950 dark:focus:bg-zinc-950"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">
            Pasta / Lista
          </label>
          <select
            value={listId}
            onChange={(e) => {
              setListId(e.target.value);
              const updated = { ...task, title, notes: notes || undefined, due: due ? `${due}T00:00:00.000Z` : undefined };
              (updated as any).listId = e.target.value;
              onUpdate(updated);
            }}
            className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-sm font-medium outline-none dark:border-zinc-800 dark:bg-zinc-950"
          >
            {lists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.title}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide flex items-center gap-1.5">
            <Calendar size={13} />
            <span>Prazo de Conclusão</span>
          </label>
          <div className="flex gap-2">
            <input
              type="date"
              value={due}
              onChange={(e) => {
                setDue(e.target.value);
              }}
              onBlur={handleSave}
              className="flex-1 rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-sm font-medium outline-none dark:border-zinc-800 dark:bg-zinc-955"
            />
            {due && (
              <button
                type="button"
                onClick={() => {
                  setDue("");
                  const updated = {
                    ...task,
                    title,
                    notes: notes || undefined,
                    due: undefined,
                  };
                  onUpdate(updated);
                }}
                className="rounded-xl border border-zinc-200 bg-white px-3 text-xs font-semibold text-red-600 hover:bg-red-50 dark:border-zinc-800 dark:bg-zinc-900"
              >
                Limpar
              </button>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide flex items-center gap-1.5">
            <Notes size={13} />
            <span>Descrição / Anotações</span>
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={handleSave}
            placeholder="Adicione detalhes sobre esta tarefa..."
            rows={6}
            className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 focus:bg-white dark:border-zinc-800 dark:bg-zinc-955 dark:focus:bg-zinc-950 resize-y"
          />
        </div>
      </div>

      <div className="mt-auto border-t border-zinc-100 pt-4 dark:border-zinc-800 flex justify-between gap-3">
        <button
          onClick={onDelete}
          className="flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50/50 px-4 py-2.5 text-xs font-bold text-red-600 hover:bg-red-50 dark:border-red-950/20 dark:bg-red-950/10 dark:text-red-400"
        >
          <Trash size={14} />
          <span>Excluir Tarefa</span>
        </button>
        <button
          onClick={onClose}
          className="rounded-xl bg-zinc-100 px-5 py-2.5 text-xs font-bold hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700"
        >
          Fechar
        </button>
      </div>
    </aside>
  );
}

// ==========================================
// COMPONENT: SettingsModal
// ==========================================
interface SettingsModalProps {
  onClose: () => void;
}

function SettingsModal({ onClose }: SettingsModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
        
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-50">
            Credenciais do Servidor (.env)
          </h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            <Close size={18} />
          </button>
        </div>

        <div className="space-y-4 text-sm leading-relaxed text-zinc-600 dark:text-zinc-350">
          <p>
            Para carregar as tarefas <strong>automaticamente direto da API do Google Tasks</strong> sem precisar clicar em nenhum botão de login no navegador, adicione as credenciais do seu projeto no arquivo <code>.env</code> na raiz do projeto:
          </p>

          <pre className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-[11px] font-mono text-zinc-800 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-350 overflow-x-auto whitespace-pre leading-relaxed">
{`# Credenciais Google OAuth 2.0 (do Google Cloud Console)
GOOGLE_CLIENT_ID=seu_client_id_do_google.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=seu_client_secret_do_google
GOOGLE_REFRESH_TOKEN=seu_refresh_token_gerado

# Chave de identificação da API (Quota)
TASK_API_KEY=AIzaSyDtxwmJPQusXFkMxIZpsGEW3_OWfaCcrr8`}
          </pre>

          <p className="text-xs text-zinc-505 dark:text-zinc-450">
            <strong>Dica:</strong> Para obter o <code>GOOGLE_REFRESH_TOKEN</code> para uso pessoal, você pode configurar o OAuth consent screen no Google Cloud Console, rodar o login uma vez para gerar o token ou usar ferramentas como o Google OAuth Playground para gerá-lo de forma simplificada com o escopo <code>https://www.googleapis.com/auth/tasks</code>.
          </p>
        </div>

        <div className="mt-6 flex justify-end pt-4 border-t border-zinc-100 dark:border-zinc-800">
          <button
            onClick={onClose}
            className="rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-blue-500"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
