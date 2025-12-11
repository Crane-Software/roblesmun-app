import {
  useState,
  useEffect,
  type FC,
  type ChangeEvent,
  type FormEvent,
} from "react";
import type { PressItem } from "../../interfaces/PressItem";
import type { PressSection } from "../../interfaces/PressSection";
import type { DocumentSnapshot } from "firebase/firestore";
import {
  FaTrash,
  FaEdit,
  FaImage,
  FaSave,
  FaSortAlphaDown,
  FaSortAlphaUp,
  FaClock,
  FaHome,
  FaVideo,
  FaPlay,
  FaFolder,
  FaChevronLeft,
  FaChevronRight,
  FaUpload,
  FaCheck,
  FaTimes,
  FaCheckSquare,
  FaSquare,
} from "react-icons/fa";
import Loader from "../../components/Loader";
import { FirestoreService } from "../../firebase/firestore";
import { SupabaseStorage } from "../../supabase/storage";
import { Link } from "react-router-dom";
import { type ReactElement } from "react";
import { formatToBucket } from "../../utils/formatToBucket";
import XButton from "../../components/XButton";

type SortOption = "newest" | "oldest" | "alphabetical" | "reverse-alphabetical";

const ITEMS_PER_PAGE = 6;

const PressManagement: FC = () => {
  // --- ESTADOS ---
  const [pressItems, setPressItems] = useState<PressItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<PressItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState<boolean>(false);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string>("");
  const [sortOption, setSortOption] = useState<SortOption>("newest");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [showSectionManager, setShowSectionManager] = useState<boolean>(false);
  const [newSectionName, setNewSectionName] = useState<string>("");
  const [sections, setSections] = useState<PressSection[]>([]);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);

  const [selectedMedia, setSelectedMedia] = useState<PressItem | null>(null);
  const [showMediaModal, setShowMediaModal] = useState<boolean>(false);

  const [formData, setFormData] = useState<PressItem>({
    edition: "XVII",
    type: "photo",
    url: "",
    title: "",
    section: "",
  });

  // Estados para Carga en Lote
  const [showBulkUpload, setShowBulkUpload] = useState<boolean>(false);
  const [bulkFiles, setBulkFiles] = useState<File[]>([]);
  const [bulkSection, setBulkSection] = useState<string>("");
  const [bulkEdition, setBulkEdition] = useState<string>("XVII");
  const [bulkUploadProgress, setBulkUploadProgress] = useState<number>(0);
  const [isBulkUploading, setIsBulkUploading] = useState<boolean>(false);
  const [uploadedCount, setUploadedCount] = useState<number>(0);

  // Estado para selección múltiple
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // --- FUNCIONES DE CARGA DE DATOS ---
  const fetchPressItems = async (append: boolean = false) => {
    if (append) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
    }

    try {
      if (searchTerm.trim()) {
        const allData = await FirestoreService.getAll<PressItem>("press");
        setPressItems(allData);
        setHasMore(false);
        setLastDoc(null);
        return;
      }

      const {
        data,
        lastVisible,
        hasMore: more,
      } = await FirestoreService.getPaginated<PressItem>(
        "press",
        ITEMS_PER_PAGE,
        append ? lastDoc : null,
        "createdAt",
        "desc"
      );

      if (append) {
        setPressItems((prev) => [...prev, ...data]);
      } else {
        setPressItems(data);
      }

      setLastDoc(lastVisible);
      setHasMore(more);
    } catch (error) {
      console.error("Error fetching press items:", error);
      setPressItems([]);
      setHasMore(false);
      setLastDoc(null);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  const fetchSections = async () => {
    try {
      const data = await FirestoreService.getAll<PressSection>("pressSections");
      setSections(data);
    } catch (error) {
      console.error("Error fetching sections:", error);
      setSections([]);
    }
  };

  // --- FUNCIONES DE FILTRADO Y ORDENAMIENTO ---
  const sortItems = (
    itemsList: PressItem[],
    option: SortOption
  ): PressItem[] => {
    const sorted = [...itemsList];
    switch (option) {
      case "newest":
        return sorted.sort((a, b) => {
          const dateA = new Date(a.createdAt || "");
          const dateB = new Date(b.createdAt || "");
          return dateB.getTime() - dateA.getTime();
        });
      case "oldest":
        return sorted.sort((a, b) => {
          const dateA = new Date(a.createdAt || "");
          const dateB = new Date(b.createdAt || "");
          return dateA.getTime() - dateB.getTime();
        });
      case "alphabetical":
        return sorted.sort((a, b) => a.title.localeCompare(b.title));
      case "reverse-alphabetical":
        return sorted.sort((a, b) => b.title.localeCompare(a.title));
      default:
        return sorted;
    }
  };

  const filterItems = (itemsList: PressItem[], search: string): PressItem[] => {
    if (!search.trim()) return itemsList;
    const searchLower = search.toLowerCase();
    return itemsList.filter(
      (item) =>
        item.title.toLowerCase().includes(searchLower) ||
        item.section.toLowerCase().includes(searchLower) ||
        item.edition.toLowerCase().includes(searchLower)
    );
  };

  useEffect(() => {
    const filtered = filterItems(pressItems, searchTerm);
    const sorted = sortItems(filtered, sortOption);
    setFilteredItems(sorted);
  }, [pressItems, sortOption, searchTerm]);

  const handleSortChange = (option: SortOption) => {
    setSortOption(option);
  };

  // --- FUNCIONES DE FORMULARIO INDIVIDUAL ---
  const handleMediaChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();
    const imageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"];
    const videoExtensions = [".mp4", ".mov", ".webm", ".mkv", ".avi"];

    const isImage =
      file.type.startsWith("image/") ||
      imageExtensions.some((ext) => fileName.endsWith(ext));
    const isVideo =
      file.type.startsWith("video/") ||
      videoExtensions.some((ext) => fileName.endsWith(ext));

    if (!isImage && !isVideo) {
      alert("Formato no soportado.");
      return;
    }

    if (isImage && file.size > 10 * 1024 * 1024) {
      alert("La imagen no debe superar los 10MB");
      return;
    }

    if (isVideo && file.size > 100 * 1024 * 1024) {
      alert("El video no debe superar los 100MB");
      return;
    }

    setMediaFile(file);
    setFormData((prev) => ({ ...prev, type: isImage ? "photo" : "video" }));

    const reader = new FileReader();
    reader.onload = (e) => {
      setMediaPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleInputChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setFormData({
      edition: "XVII",
      type: "photo",
      url: "",
      title: "",
      section: "",
    });
    setMediaFile(null);
    setMediaPreview("");
    setEditingId(null);
    setShowForm(false);
    setUploadProgress(0);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      let mediaUrl = formData.url;

      if (mediaFile) {
        try {
          setUploadProgress(30);
          const sectionBucket = formatToBucket(formData.section);
          if (formData.type === "photo") {
            mediaUrl = await SupabaseStorage.uploadPressImage(
              mediaFile,
              sectionBucket
            );
          } else {
            mediaUrl = await SupabaseStorage.uploadPressVideo(
              mediaFile,
              sectionBucket
            );
          }
          setUploadProgress(100);
        } catch (uploadError) {
          console.error("❌ Error subiendo archivo:", uploadError);
          alert("Error subiendo el archivo.");
          setUploadProgress(0);
          return;
        }
      }

      const sectionBucket = formatToBucket(formData.section);
      const pressData: PressItem = {
        edition: formData.edition,
        type: formData.type,
        url: mediaUrl,
        title: formData.title,
        section: formData.section,
        sectionBucket: sectionBucket,
      };

      if (editingId) {
        const currentItem = pressItems.find((item) => item.id === editingId);
        if (currentItem?.url && mediaFile && currentItem.url !== mediaUrl) {
          try {
            await SupabaseStorage.deletePressFile(currentItem.url);
          } catch (error) {
            console.warn("⚠️ No se pudo eliminar el archivo anterior", error);
          }
        }
        await FirestoreService.update("press", editingId, pressData);
        alert("Elemento actualizado exitosamente");
      } else {
        await FirestoreService.add("press", {
          ...pressData,
          createdAt: new Date().toISOString(),
        });
        alert("Elemento agregado exitosamente");
      }

      resetForm();
      await fetchPressItems();
    } catch (error) {
      console.error("Error al guardar elemento:", error);
      alert("Error al guardar elemento: " + (error as Error).message);
    } finally {
      setIsSubmitting(false);
      setUploadProgress(0);
    }
  };

  const handleEdit = (item: PressItem) => {
    setFormData({
      edition: item.edition,
      type: item.type,
      url: item.url,
      title: item.title,
      section: item.section,
    });
    setMediaPreview(item.url);
    setEditingId(item.id || null);
    setShowForm(true);
    setShowBulkUpload(false); // Cerrar carga masiva si se abre edición
  };

  const handleDelete = async (id: string) => {
    if (!id) return;
    const confirmDelete = window.confirm(
      "¿Estás seguro de que deseas eliminar este elemento? Esta acción eliminará también el archivo."
    );
    if (!confirmDelete) return;

    setIsLoading(true);
    try {
      const item = pressItems.find((p) => p.id === id);
      if (item?.url) {
        try {
          await SupabaseStorage.deletePressFile(item.url);
        } catch (error) {
          console.warn("⚠️ No se pudo eliminar el archivo", error);
        }
      }
      await FirestoreService.delete("press", id);
      alert("Elemento eliminado exitosamente");
      await fetchPressItems();
    } catch (error) {
      console.error("Error al eliminar elemento:", error);
      alert("Error al eliminar elemento");
    } finally {
      setIsLoading(false);
    }
  };

  // --- GESTIÓN DE SECCIONES ---
  const handleCreateSection = async () => {
    if (!newSectionName.trim()) {
      alert("Ingresa un nombre válido para la sección");
      return;
    }
    const bucketName = formatToBucket(newSectionName);
    try {
      const sectionExists = sections.some(
        (s) => s.bucket.toLowerCase() === bucketName.toLowerCase()
      );
      if (sectionExists) {
        alert("Esta sección ya existe");
        return;
      }
      const sectionData: PressSection = {
        name: newSectionName.trim(),
        bucket: bucketName,
        createdAt: new Date().toISOString(),
      };
      await FirestoreService.add("pressSections", sectionData);
      alert(`Sección "${newSectionName}" creada exitosamente.`);
      setNewSectionName("");
      setShowSectionManager(false);
      await fetchSections();
    } catch (error) {
      console.error("Error creando sección:", error);
      alert("Error al crear la sección");
    }
  };

  const handleDeleteSection = async (sectionName: string) => {
    const confirmDelete = window.confirm(
      `¿Estás seguro de que deseas eliminar la sección "${sectionName}"?`
    );
    if (!confirmDelete) return;
    try {
      const sectionToDelete = sections.find((s) => s.name === sectionName);
      if (!sectionToDelete || !sectionToDelete.id) {
        alert("Sección no encontrada.");
        return;
      }
      await FirestoreService.delete("pressSections", sectionToDelete.id);
      alert(`Sección "${sectionName}" eliminada exitosamente.`);
      await fetchSections();
    } catch (error) {
      console.error("Error al eliminar sección:", error);
      alert("Error al eliminar la sección");
    }
  };

  // --- CARGA EN LOTE ---
  const handleBulkFilesChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    if (files.length > 50) {
      alert("Máximo 50 archivos por lote");
      return;
    }

    const validFiles: File[] = [];
    const invalidFiles: string[] = [];

    files.forEach((file) => {
      const fileName = file.name.toLowerCase();
      const imageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
      const videoExtensions = [".mp4", ".mov", ".webm"];

      const isImage =
        file.type.startsWith("image/") ||
        imageExtensions.some((ext) => fileName.endsWith(ext));
      const isVideo =
        file.type.startsWith("video/") ||
        videoExtensions.some((ext) => fileName.endsWith(ext));

      if (!isImage && !isVideo) {
        invalidFiles.push(file.name);
        return;
      }
      if (isImage && file.size > 10 * 1024 * 1024) {
        invalidFiles.push(`${file.name} (imagen > 10MB)`);
        return;
      }
      if (isVideo && file.size > 100 * 1024 * 1024) {
        invalidFiles.push(`${file.name} (video > 100MB)`);
        return;
      }
      validFiles.push(file);
    });

    if (invalidFiles.length > 0) {
      alert(
        `Archivos no válidos (${invalidFiles.length}):\n${invalidFiles.join(
          "\n"
        )}`
      );
    }
    setBulkFiles(validFiles);
  };

  const handleRemoveBulkFile = (index: number) => {
    setBulkFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const resetBulkForm = () => {
    setBulkFiles([]);
    setBulkSection("");
    setBulkEdition("XVII");
    setBulkUploadProgress(0);
    setUploadedCount(0);
    setShowBulkUpload(false);
  };

  const handleBulkSubmit = async () => {
    if (bulkFiles.length === 0) {
      alert("No hay archivos seleccionados");
      return;
    }
    if (!bulkSection.trim()) {
      alert("Debes especificar una sección");
      return;
    }

    const confirmUpload = window.confirm(
      `¿Confirmas subir ${bulkFiles.length} archivos a "${bulkSection}"?`
    );
    if (!confirmUpload) return;

    setIsBulkUploading(true);
    setUploadedCount(0);
    setBulkUploadProgress(0);

    const sectionBucket = formatToBucket(bulkSection);
    const successfulUploads: string[] = [];
    const failedUploads: { file: string; error: string }[] = [];

    try {
      for (let i = 0; i < bulkFiles.length; i++) {
        const file = bulkFiles[i];
        const fileNumber = i + 1;

        try {
          let mediaUrl = "";
          const isImage = file.type.startsWith("image/");
          const isVideo = file.type.startsWith("video/");

          if (isImage) {
            mediaUrl = await SupabaseStorage.uploadPressImage(
              file,
              sectionBucket
            );
          } else if (isVideo) {
            mediaUrl = await SupabaseStorage.uploadPressVideo(
              file,
              sectionBucket
            );
          } else {
            throw new Error(`Tipo no soportado: ${file.type}`);
          }

          const fileNameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
          const pressData: PressItem = {
            edition: bulkEdition.trim(),
            type: isImage ? "photo" : "video",
            url: mediaUrl,
            title: fileNameWithoutExt,
            section: bulkSection.trim(),
            sectionBucket: sectionBucket,
            createdAt: new Date().toISOString(),
          };

          await FirestoreService.add("press", pressData);
          successfulUploads.push(file.name);
          setUploadedCount((prev) => prev + 1);
          setBulkUploadProgress((fileNumber / bulkFiles.length) * 100);
          await new Promise((resolve) => setTimeout(resolve, 300));
        } catch (fileError) {
          console.error(`❌ Error procesando ${file.name}:`, fileError);
          failedUploads.push({
            file: file.name,
            error:
              fileError instanceof Error
                ? fileError.message
                : "Error desconocido",
          });
        }
      }

      let message = `Carga completada:\n✅ ${successfulUploads.length} exitosos\n`;
      if (failedUploads.length > 0) {
        message += `❌ ${failedUploads.length} fallidos`;
      }
      alert(message);

      if (successfulUploads.length > 0) {
        resetBulkForm();
        await fetchPressItems();
      }
    } catch (error) {
      console.error("❌ Error crítico:", error);
      alert("Error crítico durante la carga");
    } finally {
      setIsBulkUploading(false);
      setBulkUploadProgress(0);
      setUploadedCount(0);
    }
  };

  // --- EFECTOS Y UTILIDADES ---
  useEffect(() => {
    fetchPressItems();
    fetchSections();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const availableSections = Array.from(
    new Set([
      ...sections.map((s) => s.name),
      ...pressItems.map((item) => item.section),
    ])
  ).sort();

  const itemsToDisplay = filteredItems;
  const totalPages = Math.ceil(itemsToDisplay.length / ITEMS_PER_PAGE);
  const displayedItems = searchTerm.trim()
    ? itemsToDisplay.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
      )
    : itemsToDisplay;

  useEffect(() => {
    if (searchTerm.trim()) {
      setCurrentPage(1);
      setLastDoc(null);
    }
  }, [sortOption, searchTerm]);

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleLoadMore = () => {
    fetchPressItems(true);
  };

  const handleMediaClick = (item: PressItem) => {
    setSelectedMedia(item);
    setShowMediaModal(true);
  };

  const handleCloseModal = () => {
    setShowMediaModal(false);
    setSelectedMedia(null);
  };

  const handleDownload = async () => {
    if (!selectedMedia) return;
    try {
      const response = await fetch(selectedMedia.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const extension = selectedMedia.type === "video" ? "mp4" : "jpg";
      link.download = `${selectedMedia.title.replace(
        /\s+/g,
        "-"
      )}.${extension}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading file:", error);
      alert("Error al descargar el archivo");
    }
  };

  const handleMediaPreviewError = (
    e: React.SyntheticEvent<HTMLImageElement>
  ) => {
    e.currentTarget.src =
      "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1zbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDJMMTMuMDkgOC4yNkwyMCA5TDEzLjA5IDE1Ljc0TDEyIDIyTDEwLjkxIDE1Ljc0TDQgOUwxMC45MSA4LjI2TDEyIDJaIiBmaWxsPSIjNjY2Ii8+Cjwvc3ZnPgo=";
  };

  const sortOptions: Array<{
    value: SortOption;
    label: string;
    icon: ReactElement;
  }> = [
    { value: "newest", label: "Recientes", icon: <FaClock /> },
    { value: "oldest", label: "Antiguos", icon: <FaClock /> },
    { value: "alphabetical", label: "A-Z", icon: <FaSortAlphaDown /> },
    { value: "reverse-alphabetical", label: "Z-A", icon: <FaSortAlphaUp /> },
  ];

  // Seleccionar/deseleccionar individual
  const handleSelectItem = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // Seleccionar/deseleccionar todos los mostrados
  const handleSelectAll = () => {
    if (selectedIds.length === displayedItems.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(displayedItems.map((item) => item.id!));
    }
  };

  // Eliminar seleccionados
  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return;
    if (
      !window.confirm(
        `¿Seguro que deseas eliminar ${selectedIds.length} archivo(s)? Esta acción no se puede deshacer.`
      )
    )
      return;
    setIsLoading(true);
    try {
      for (const id of selectedIds) {
        const item = pressItems.find((p) => p.id === id);
        if (item?.url) {
          try {
            await SupabaseStorage.deletePressFile(item.url);
          } catch (error) {
            console.warn("No se pudo eliminar el archivo", error);
          }
        }
        await FirestoreService.delete("press", id);
      }
      alert(`Eliminados ${selectedIds.length} archivos exitosamente`);
      setSelectedIds([]);
      await fetchPressItems();
    } catch (error) {
      console.error("Error al eliminar archivos:", error);
      alert("Error al eliminar archivos");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-12 font-montserrat-light w-full">
      <div className="p-0">
        {/* HEADER */}
        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center mb-6 gap-4">
          <div className="flex flex-col items-start">
            <h1 className="text-4xl font-montserrat-bold">Prensa</h1>
            <Link
              to="/admin"
              className="px-6 py-2 my-4 bg-glass border border-gray-600 rounded-lg text-[#f0f0f0] hover:border-[#d53137] hover:bg-gray-700 transition-colors flex items-center gap-2 font-medium"
            >
              <FaHome size={16} />
              Panel Admin
            </Link>
            <p className="text-gray-400">
              Total de archivos: {pressItems.length}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <input
              type="text"
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-4 py-2 bg-glass border border-gray-600 rounded-lg text-[#f0f0f0] focus:border-[#d53137] outline-none"
            />

            <button
              onClick={() => {
                setShowBulkUpload(!showBulkUpload);
                setShowForm(false);
              }}
              className="bg-blue-600 text-white cursor-pointer px-6 py-3 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition-colors"
            >
              <FaUpload />
              Carga en Lote
            </button>

            <button
              onClick={() => {
                setShowForm(!showForm);
                setShowBulkUpload(false);
                if (!showForm) resetForm();
              }}
              className="bg-[#d53137] text-white cursor-pointer px-6 py-3 rounded-lg flex items-center gap-2 hover:bg-[#b71c1c] transition-colors"
            >
              {showForm ? "Cancelar" : "Nuevo Archivo"}
            </button>
          </div>
        </div>

        {/* BARRA DE ACCIONES MASIVAS */}
        {selectedIds.length > 0 && (
          <div className="mb-6 p-4 bg-[#d53137]/20 border-2 border-[#d53137] rounded-lg flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <FaCheckSquare className="text-[#d53137] text-2xl" />
              <span className="text-lg font-montserrat-bold text-white">
                {selectedIds.length} archivo(s) seleccionado(s)
              </span>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleDeleteSelected}
                className="bg-red-600 text-white px-6 py-2 rounded-lg font-montserrat-bold hover:bg-red-700 transition-colors cursor-pointer flex items-center gap-2"
              >
                <FaTrash />
                Eliminar seleccionados
              </button>
              <button
                onClick={() => setSelectedIds([])}
                className="bg-glass text-[#f0f0f0] px-6 py-2 rounded-lg hover:bg-gray-700 transition-colors cursor-pointer"
              >
                Cancelar selección
              </button>
            </div>
          </div>
        )}

        {/* SECCIÓN DE CARGA EN LOTE */}
        {showBulkUpload && (
          <div className="bg-glass p-6 rounded-lg mb-8 border-2 border-blue-600">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-montserrat-bold flex items-center gap-2">
                <FaUpload className="text-blue-400" />
                Carga en Lote
              </h2>
              <button
                aria-label="button"
                onClick={resetBulkForm}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <FaTimes size={24} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block mb-2 text-sm font-medium text-gray-300">
                  Edición *
                </label>
                <input
                  type="text"
                  value={bulkEdition}
                  onChange={(e) => setBulkEdition(e.target.value)}
                  className="w-full p-3 bg-[#101010] border border-gray-600 rounded-lg text-[#f0f0f0] focus:border-blue-400 outline-none"
                  placeholder="Ej: XVII"
                />
              </div>

              <div>
                <label className="block mb-2 text-sm font-medium text-gray-300">
                  Sección *
                </label>
                <input
                  type="text"
                  value={bulkSection}
                  onChange={(e) => setBulkSection(e.target.value)}
                  list="sections-bulk"
                  className="w-full p-3 bg-[#101010] border border-gray-600 rounded-lg text-[#f0f0f0] focus:border-blue-400 outline-none"
                  placeholder="Ej: Inauguración"
                />
                <datalist id="sections-bulk">
                  {availableSections.map((section) => (
                    <option key={section} value={section} />
                  ))}
                </datalist>
              </div>
            </div>

            <div className="border-2 border-dashed border-blue-600 rounded-lg p-8 text-center mb-6">
              <label className="cursor-pointer">
                <span className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center gap-2">
                  <FaUpload />
                  Seleccionar archivos
                </span>
                <input
                  type="file"
                  multiple
                  accept="image/*,video/mp4,video/quicktime,video/webm"
                  onChange={handleBulkFilesChange}
                  className="hidden"
                />
              </label>
              <p className="text-sm text-gray-400 mt-4">
                Máximo 50 archivos por lote • Imágenes: Máximo 10MB • Videos:
                Máximo 100MB
              </p>
            </div>

            {bulkFiles.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-montserrat-bold mb-4">
                  Archivos seleccionados ({bulkFiles.length})
                </h3>
                <div className="max-h-96 overflow-y-auto space-y-2 pr-2">
                  {bulkFiles.map((file, index) => {
                    const isVideo = file.type.startsWith("video/");
                    const sizeMB = (file.size / 1024 / 1024).toFixed(2);
                    const isUploaded = index < uploadedCount;

                    return (
                      <div
                        key={index}
                        className={`bg-[#101010] p-3 rounded-lg flex items-center justify-between transition-all ${
                          isUploaded
                            ? "border border-green-600"
                            : "border border-gray-700"
                        }`}
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          {isUploaded ? (
                            <FaCheck className="text-green-400 flex-shrink-0" />
                          ) : isVideo ? (
                            <FaVideo className="text-purple-400 flex-shrink-0" />
                          ) : (
                            <FaImage className="text-blue-400 flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p
                              className={`text-sm font-medium truncate ${
                                isUploaded ? "text-green-400" : ""
                              }`}
                            >
                              {file.name}
                            </p>
                            <p className="text-xs text-gray-400">
                              {sizeMB} MB • {isVideo ? "Video" : "Imagen"}
                            </p>
                          </div>
                        </div>
                        {!isBulkUploading && (
                          <button
                            onClick={() => handleRemoveBulkFile(index)}
                            className="text-red-400 hover:text-red-600 transition-colors ml-2 flex-shrink-0"
                            aria-label="delete file"
                          >
                            <FaTrash size={16} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {isBulkUploading && (
              <div className="mb-6">
                <div className="bg-gray-700 rounded-full h-4 overflow-hidden mb-2">
                  <div
                    className="bg-blue-600 h-full transition-all duration-300"
                    style={{ width: `${bulkUploadProgress}%` }}
                  />
                </div>
                <p className="text-sm text-center text-gray-300">
                  Subiendo {uploadedCount} de {bulkFiles.length} archivos...{" "}
                  {bulkUploadProgress.toFixed(0)}%
                </p>
              </div>
            )}

            <div className="flex gap-4">
              <button
                onClick={handleBulkSubmit}
                disabled={
                  isBulkUploading ||
                  bulkFiles.length === 0 ||
                  !bulkSection.trim()
                }
                className="flex-1 bg-blue-600 cursor-pointer text-white px-8 py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 hover:bg-blue-700"
              >
                {isBulkUploading ? (
                  <>
                    <FaClock className="animate-spin" /> Subiendo...
                  </>
                ) : (
                  <>
                    <FaSave /> Subir {bulkFiles.length} archivos
                  </>
                )}
              </button>
              <button
                onClick={resetBulkForm}
                disabled={isBulkUploading}
                className="bg-glass text-[#f0f0f0] px-8 py-3 rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* GESTOR DE SECCIONES */}
        {!isLoading && (
          <div className="mb-8 bg-glass p-6 rounded-lg">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-montserrat-bold flex items-center gap-2">
                <FaFolder className="text-[#d53137]" />
                Secciones ({availableSections.length})
              </h2>
              <button
                onClick={() => setShowSectionManager(!showSectionManager)}
                className="bg-[#d53137] cursor-pointer text-white px-4 py-2 rounded-lg hover:bg-[#b71c1c] transition-colors flex items-center gap-2"
              >
                {showSectionManager ? "Cancelar" : "Nueva Sección"}
              </button>
            </div>

            {showSectionManager && (
              <div className="mb-4 p-4 bg-[#101010] rounded-lg">
                <label className="block mb-2 text-sm font-medium text-gray-300">
                  Nombre de la nueva sección
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newSectionName}
                    onChange={(e) => setNewSectionName(e.target.value)}
                    placeholder="Ej: Inauguración, Clausura, Sesiones..."
                    className="flex-1 p-3 bg-glass border border-gray-600 rounded-lg text-[#f0f0f0] focus:border-[#d53137] outline-none"
                    onKeyPress={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleCreateSection();
                      }
                    }}
                  />
                  <button
                    onClick={handleCreateSection}
                    className="bg-[#d53137] cursor-pointer text-white px-6 py-3 rounded-lg hover:bg-[#b71c1c] transition-colors"
                  >
                    Crear
                  </button>
                </div>
              </div>
            )}

            {availableSections.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {availableSections.map((section) => {
                  const itemsInSection = pressItems.filter(
                    (item) => item.section === section
                  );
                  const photosCount = itemsInSection.filter(
                    (i) => i.type === "photo"
                  ).length;
                  const videosCount = itemsInSection.filter(
                    (i) => i.type === "video"
                  ).length;
                  const sampleItem = itemsInSection[0];
                  const bucketName =
                    sampleItem?.sectionBucket || formatToBucket(section);

                  return (
                    <div
                      key={section}
                      className="p-4 bg-[#101010] rounded-lg border border-gray-600 hover:border-[#d53137] transition-all"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <FaFolder className="text-[#d53137]" />
                          <h3 className="font-montserrat-bold text-sm">
                            {section}
                          </h3>
                        </div>
                        <button
                          onClick={() => handleDeleteSection(section)}
                          className="text-red-400 hover:text-red-600 transition-colors"
                          title="Eliminar sección"
                        >
                          <FaTrash size={14} />
                        </button>
                      </div>
                      <div className="text-xs text-gray-400 space-y-1">
                        <p>
                          Total: {itemsInSection.length} archivo
                          {itemsInSection.length !== 1 ? "s" : ""}
                        </p>
                        <p>
                          {photosCount} foto{photosCount !== 1 ? "s" : ""} •{" "}
                          {videosCount} video{videosCount !== 1 ? "s" : ""}
                        </p>
                        <p className="text-gray-300">
                          Bucket:{" "}
                          <span className="font-montserrat-bold">
                            {bucketName}
                          </span>
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                <FaFolder className="mx-auto text-4xl mb-2 opacity-30" />
                <p className="text-sm">No hay secciones creadas.</p>
              </div>
            )}
          </div>
        )}

        {/* FILTROS */}
        {!isLoading && pressItems.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <span className="text-sm text-gray-300 font-medium">
              Ordenar por:
            </span>
            <div className="flex gap-2 flex-wrap">
              {sortOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleSortChange(option.value)}
                  className={`px-4 py-2 cursor-pointer rounded-lg flex items-center gap-2 text-sm transition-colors ${
                    sortOption === option.value
                      ? "bg-[#d53137] text-white"
                      : "bg-glass text-gray-300 hover:bg-gray-700"
                  }`}
                >
                  {option.icon}
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* FORMULARIO INDIVIDUAL */}
        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="bg-glass p-6 rounded-lg mb-8"
          >
            <h2 className="text-2xl font-montserrat-bold mb-6">
              {editingId ? "Editar Archivo" : "Nuevo Archivo"}
            </h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block mb-2 text-sm font-medium text-gray-300">
                    Título *
                  </label>
                  <input
                    type="text"
                    name="title"
                    value={formData.title}
                    onChange={handleInputChange}
                    required
                    className="w-full p-3 bg-[#101010] border border-gray-600 rounded-lg text-[#f0f0f0] focus:border-[#d53137] outline-none"
                    placeholder="Ej: Inauguración del evento"
                  />
                </div>

                <div>
                  <label className="block mb-2 text-sm font-medium text-gray-300">
                    Edición *
                  </label>
                  <input
                    type="text"
                    name="edition"
                    value={formData.edition}
                    onChange={handleInputChange}
                    required
                    className="w-full p-3 bg-[#101010] border border-gray-600 rounded-lg text-[#f0f0f0] focus:border-[#d53137] outline-none"
                    placeholder="Ej: XVII"
                  />
                </div>

                <div>
                  <label className="block mb-2 text-sm font-medium text-gray-300">
                    Sección *
                  </label>
                  <input
                    type="text"
                    name="section"
                    value={formData.section}
                    onChange={handleInputChange}
                    required
                    list="sections"
                    className="w-full p-3 bg-[#101010] border border-gray-600 rounded-lg text-[#f0f0f0] focus:border-[#d53137] outline-none"
                    placeholder="Ej: Inauguración"
                  />
                  <datalist id="sections">
                    {availableSections.map((section) => (
                      <option key={section} value={section} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block mb-2 text-sm font-medium text-gray-300">
                    Tipo
                  </label>
                  <select
                    aria-label="Tipo"
                    name="type"
                    value={formData.type}
                    onChange={handleInputChange}
                    disabled={!!mediaFile}
                    className="w-full p-3 bg-[#101010] border border-gray-600 rounded-lg text-[#f0f0f0] focus:border-[#d53137] outline-none disabled:opacity-50"
                  >
                    <option value="photo">Foto</option>
                    <option value="video">Video</option>
                  </select>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block mb-2 text-sm font-medium text-gray-300">
                    Archivo (Foto o Video) *
                  </label>

                  <div className="border-2 border-dashed border-gray-600 rounded-lg p-6 text-center hover:border-[#d53137] transition-colors">
                    {mediaPreview ? (
                      <div className="space-y-4">
                        {formData.type === "photo" ? (
                          <img
                            src={mediaPreview}
                            alt="Preview"
                            className="mx-auto max-h-48 max-w-full object-contain rounded-lg"
                            onError={handleMediaPreviewError}
                          />
                        ) : (
                          <div className="relative">
                            <video
                              src={mediaPreview}
                              className="mx-auto max-h-48 max-w-full rounded-lg"
                              controls
                            />
                            <FaPlay className="absolute inset-0 m-auto text-white text-4xl opacity-70 pointer-events-none" />
                          </div>
                        )}
                        <div className="flex gap-2 justify-center">
                          <label className="bg-[#d53137] text-white px-4 py-2 rounded-lg cursor-pointer hover:bg-[#b71c1c] transition-colors flex items-center gap-2">
                            {formData.type === "photo" ? (
                              <FaImage />
                            ) : (
                              <FaVideo />
                            )}
                            Cambiar archivo
                            <input
                              type="file"
                              accept="image/*,video/mp4,video/quicktime,video/webm"
                              onChange={handleMediaChange}
                              className="hidden"
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              setMediaPreview("");
                              setMediaFile(null);
                            }}
                            className="bg-glass text-[#f0f0f0] px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-2"
                          >
                            Quitar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {formData.type === "photo" ? (
                          <FaImage className="mx-auto text-6xl text-gray-400" />
                        ) : (
                          <FaVideo className="mx-auto text-6xl text-gray-400" />
                        )}
                        <div>
                          <label className="bg-[#d53137] text-white px-6 py-3 rounded-lg cursor-pointer hover:bg-[#b71c1c] transition-colors inline-flex items-center gap-2">
                            {formData.type === "photo" ? (
                              <FaImage />
                            ) : (
                              <FaVideo />
                            )}
                            Seleccionar archivo
                            <input
                              type="file"
                              accept="image/*,video/mp4,video/quicktime,video/webm"
                              onChange={handleMediaChange}
                              className="hidden"
                            />
                          </label>
                        </div>
                        <p className="text-sm text-gray-400">
                          Imágenes: Máximo 10MB • JPG, PNG, GIF, WebP
                          <br />
                          Videos: Máximo 100MB • MP4, MOV, WebM
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-4 mt-8 pt-6 border-t border-gray-600">
              <button
                type="submit"
                disabled={isSubmitting || (!mediaFile && !editingId)}
                className="flex-1 bg-[#d53137] text-white px-6 py-3 rounded-lg hover:bg-[#b71c1c] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-montserrat-bold"
              >
                {isSubmitting ? (
                  <>
                    <FaClock className="animate-spin" />
                    {uploadProgress > 0
                      ? `Subiendo ${uploadProgress}%`
                      : "Guardando..."}
                  </>
                ) : (
                  <>
                    <FaSave />
                    {editingId ? "Actualizar" : "Guardar"}
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="bg-glass text-[#f0f0f0] px-6 py-3 rounded-lg hover:bg-gray-700 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}

        {isLoading && <Loader message="Cargando archivos..." />}

        {/* GRID DE CONTENIDO */}
        {!isLoading && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Selector de todos */}
              <div className="col-span-full flex items-center mb-2">
                <button
                  onClick={handleSelectAll}
                  className="text-lg text-gray-300 flex items-center gap-2 cursor-pointer"
                >
                  {selectedIds.length === displayedItems.length ? (
                    <FaCheckSquare className="text-[#d53137]" />
                  ) : (
                    <FaSquare />
                  )}
                  {selectedIds.length === displayedItems.length
                    ? "Deseleccionar todos"
                    : "Seleccionar todos"}
                </button>
              </div>
              {displayedItems.map((item) => (
                <div
                  key={item.id}
                  className={`relative p-4 bg-glass rounded-lg border border-gray-700 hover:border-[#d53137] transition-all duration-300`}
                >
                  {/* Checkbox de selección */}
                  <button
                    onClick={() => handleSelectItem(item.id!)}
                    className="absolute top-4 left-4 z-10 text-2xl cursor-pointer"
                    aria-label="Seleccionar"
                  >
                    {selectedIds.includes(item.id!) ? (
                      <FaCheckSquare className="text-[#d53137]" />
                    ) : (
                      <FaSquare className="text-gray-400" />
                    )}
                  </button>
                  <div
                    className="w-full h-48 flex items-center justify-center mb-4 bg-[#101010] rounded overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => handleMediaClick(item)}
                  >
                    {item.type === "photo" ? (
                      <img
                        src={item.url}
                        alt={item.title}
                        className="max-w-full max-h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src =
                            "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1zbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDJMMTMuMDkgOC4yNkwyMCA5TDEzLjA5IDE1Ljc0TDEyIDIyTDEwLjkxIDE1Ljc0TDQgOUwxMC45MSA4LjI2TDEyIDJaIiBmaWxsPSIjNjY2Ii8+Cjwvc3ZnPgo=";
                        }}
                      />
                    ) : (
                      <div className="relative w-full h-full">
                        <video
                          src={item.url}
                          className="w-full h-full object-cover"
                          preload="metadata"
                        />
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <FaPlay className="text-white text-4xl opacity-70" />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-lg font-montserrat-bold line-clamp-2">
                      {item.title}
                    </h3>
                    <div className="flex gap-2 text-xs text-gray-400">
                      <span className="bg-[#d53137] px-2 py-1 rounded">
                        {item.edition}
                      </span>
                      <span className="bg-blue-600 px-2 py-1 rounded">
                        {item.section}
                      </span>
                      <span className="bg-gray-700 px-2 py-1 rounded">
                        {item.type === "photo" ? "Foto" : "Video"}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-4 pt-4 border-t border-gray-600">
                    <button
                      onClick={() => handleEdit(item)}
                      className="flex-1 bg-glass cursor-pointer text-white px-3 py-2 rounded flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors text-sm"
                    >
                      <FaEdit />
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(item.id!)}
                      className="flex-1 bg-[#d53137] cursor-pointer text-white px-3 py-2 rounded flex items-center justify-center gap-2 hover:bg-red-700 transition-colors text-sm"
                    >
                      <FaTrash />
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {displayedItems.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-400 text-lg">
                  {searchTerm.trim()
                    ? "No se encontraron archivos con ese término de búsqueda"
                    : "No hay archivos disponibles"}
                </p>
              </div>
            )}

            {/* PAGINACIÓN */}
            {searchTerm.trim()
              ? totalPages > 1 && (
                  <div className="flex justify-center items-center gap-4 mt-8">
                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="px-4 py-2 bg-glass rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      <FaChevronLeft /> Anterior
                    </button>
                    <span className="text-gray-400">
                      Página {currentPage} de {totalPages}
                    </span>
                    <button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="px-4 py-2 bg-glass rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      Siguiente <FaChevronRight />
                    </button>
                  </div>
                )
              : hasMore && (
                  <div className="flex justify-center mt-8">
                    <button
                      onClick={handleLoadMore}
                      disabled={isLoadingMore}
                      className="px-8 py-3 bg-[#d53137] text-white rounded-lg hover:bg-[#b71c1c] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {isLoadingMore ? (
                        <>
                          <FaClock className="animate-spin" /> Cargando...
                        </>
                      ) : (
                        <>Cargar más archivos</>
                      )}
                    </button>
                  </div>
                )}
          </>
        )}

        {/* FOOTER STATS */}
        <div className="mt-8 p-4 bg-glass rounded-lg">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-montserrat-bold text-[#f0f0f0]">
                {displayedItems.length}
                {!searchTerm.trim() && hasMore && "+"}
              </div>
              <div className="text-sm text-gray-400">Total Archivos</div>
            </div>
            <div>
              <div className="text-2xl font-montserrat-bold text-blue-400">
                {displayedItems.filter((i) => i.type === "photo").length}
              </div>
              <div className="text-sm text-gray-400">Fotos</div>
            </div>
            <div>
              <div className="text-2xl font-montserrat-bold text-purple-400">
                {displayedItems.filter((i) => i.type === "video").length}
              </div>
              <div className="text-sm text-gray-400">Videos</div>
            </div>
            <div>
              <div className="text-2xl font-montserrat-bold text-green-400">
                {availableSections.length}
              </div>
              <div className="text-sm text-gray-400">Secciones</div>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL DE VISUALIZACIÓN */}
      {showMediaModal && selectedMedia && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={handleCloseModal}
        >
          <div
            className="relative max-w-6xl w-full flex flex-col items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-glass rounded-lg overflow-hidden max-h-[90vh] flex flex-col relative">
              <button
                aria-label="close"
                onClick={handleCloseModal}
                className="absolute top-4 right-4 z-10 p-2"
              >
                <XButton size={48} thickness="normal" />
              </button>
              <button
                onClick={handleDownload}
                className="absolute top-4 left-4 z-10 py-2 px-4 bg-glass cursor-pointer rounded-lg hover:bg-gray-700 transition-colors"
              >
                <span className="text-white font-montserrat-light text-md">
                  Descargar
                </span>
              </button>
              <div className="flex-shrink-0 overflow-hidden">
                {selectedMedia.type === "video" ? (
                  <video
                    className="w-full max-h-[70vh] object-contain"
                    controls
                    autoPlay
                    src={selectedMedia.url}
                  />
                ) : (
                  <img
                    src={selectedMedia.url}
                    alt={selectedMedia.title}
                    className="w-full max-h-[70vh] object-contain"
                  />
                )}
              </div>
              <div className="p-6 bg-[#181818] font-montserrat-bold flex-shrink-0">
                <h3 className="text-2xl mb-2">{selectedMedia.title}</h3>
                <div className="flex gap-2 text-sm text-gray-400 flex-wrap">
                  <span className="bg-[#d53137] px-2 py-1 rounded">
                    {selectedMedia.edition}
                  </span>
                  <span className="bg-blue-600 px-2 py-1 rounded">
                    {selectedMedia.section}
                  </span>
                  <span className="bg-gray-700 px-2 py-1 rounded">
                    {selectedMedia.type === "photo" ? "Foto" : "Video"}
                  </span>
                  {selectedMedia.sectionBucket && (
                    <span className="bg-green-700 px-2 py-1 rounded">
                      Bucket: {selectedMedia.sectionBucket}
                    </span>
                  )}
                </div>

                {/* Botones de acción en el modal */}
                <div className="flex gap-2 mt-4 pt-4 border-t border-gray-600">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCloseModal();
                      handleEdit(selectedMedia);
                    }}
                    className="flex-1 bg-glass cursor-pointer text-white px-4 py-2 rounded flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors"
                  >
                    <FaEdit /> Editar
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (
                        window.confirm(
                          "¿Estás seguro de que deseas eliminar este elemento?"
                        )
                      ) {
                        handleCloseModal();
                        handleDelete(selectedMedia.id!);
                      }
                    }}
                    className="flex-1 bg-[#d53137] cursor-pointer text-white px-4 py-2 rounded flex items-center justify-center gap-2 hover:bg-red-700 transition-colors"
                  >
                    <FaTrash /> Eliminar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PressManagement;
