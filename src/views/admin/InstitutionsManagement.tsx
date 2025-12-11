import { useState, useEffect, type FC } from "react";
import { Link } from "react-router-dom";
import {
  FaHome,
  FaBuilding,
  FaSearch,
  FaSortAlphaDown,
  FaSortAlphaUp,
  FaPlus,
  FaEdit,
  FaTrash,
  FaKey,
} from "react-icons/fa";
import { FirestoreService } from "../../firebase/firestore";
import type { FacultyCode } from "../../interfaces/FacultyCode";
import Loader from "../../components/Loader";
import XButton from "../../components/XButton";
import { generateFacultyCode } from "../../utils/facultyCodeGenerator";

type SortOption =
  | "alphabetical"
  | "reverse-alphabetical"
  | "code-asc"
  | "code-desc";

interface FacultyCodeWithId extends FacultyCode {
  id: string;
}

const InstitutionsManagement: FC = () => {
  const [institutions, setInstitutions] = useState<FacultyCodeWithId[]>([]);
  const [filteredInstitutions, setFilteredInstitutions] = useState<
    FacultyCodeWithId[]
  >([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [sortOption, setSortOption] = useState<SortOption>("alphabetical");
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Modal states
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [selectedInstitution, setSelectedInstitution] =
    useState<FacultyCodeWithId | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    institution: "",
    facultyCode: "",
  });
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string>("");

  // Fetch institutions from Firestore
  const fetchInstitutions = async () => {
    setIsLoading(true);
    try {
      const data = await FirestoreService.getAll<FacultyCodeWithId>(
        "facultyCodes"
      );
      setInstitutions(data);
      console.log(`✅ ${data.length} instituciones cargadas`);
    } catch (error) {
      console.error("Error fetching institutions:", error);
      setInstitutions([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInstitutions();
  }, []);

  // Sort institutions
  const sortInstitutions = (
    institutionsList: FacultyCodeWithId[],
    option: SortOption
  ): FacultyCodeWithId[] => {
    const sorted = [...institutionsList];
    switch (option) {
      case "alphabetical":
        return sorted.sort((a, b) =>
          (a.institution || "").localeCompare(b.institution || "")
        );
      case "reverse-alphabetical":
        return sorted.sort((a, b) =>
          (b.institution || "").localeCompare(a.institution || "")
        );
      case "code-asc":
        return sorted.sort((a, b) =>
          (a.facultyCode || "").localeCompare(b.facultyCode || "")
        );
      case "code-desc":
        return sorted.sort((a, b) =>
          (b.facultyCode || "").localeCompare(a.facultyCode || "")
        );
      default:
        return sorted;
    }
  };

  // Filter institutions
  const filterInstitutions = (
    institutionsList: FacultyCodeWithId[],
    search: string
  ): FacultyCodeWithId[] => {
    if (!search.trim()) return institutionsList;
    const searchLower = search.toLowerCase();
    return institutionsList.filter(
      (inst) =>
        inst.institution?.toLowerCase().includes(searchLower) ||
        inst.facultyCode?.toLowerCase().includes(searchLower)
    );
  };

  useEffect(() => {
    const filtered = filterInstitutions(institutions, searchTerm);
    const sorted = sortInstitutions(filtered, sortOption);
    setFilteredInstitutions(sorted);
  }, [institutions, sortOption, searchTerm]);

  const handleSortChange = (option: SortOption) => {
    setSortOption(option);
  };

  // Check if code is unique
  const isCodeUnique = (code: string, excludeId?: string): boolean => {
    return !institutions.some(
      (inst) => inst.facultyCode === code && inst.id !== excludeId
    );
  };

  // Open Add Modal
  const openAddModal = () => {
    const newCode = generateFacultyCode();
    setFormData({ institution: "", facultyCode: newCode });
    setFormError("");
    setShowAddModal(true);
  };

  // Generate new code
  const handleGenerateNewCode = () => {
    let newCode = generateFacultyCode();
    // Ensure uniqueness
    while (!isCodeUnique(newCode)) {
      newCode = generateFacultyCode();
    }
    setFormData({ ...formData, facultyCode: newCode });
  };

  // Handle Add Institution
  const handleAddInstitution = async () => {
    if (!formData.institution.trim()) {
      setFormError("El nombre de la institución es requerido");
      return;
    }

    if (!formData.facultyCode.trim() || formData.facultyCode.length !== 6) {
      setFormError("El código debe tener exactamente 6 caracteres");
      return;
    }

    if (!isCodeUnique(formData.facultyCode)) {
      setFormError("Este código ya está en uso");
      return;
    }

    setIsSaving(true);
    setFormError("");
    try {
      const newInstitution = {
        institution: formData.institution.trim(),
        facultyCode: formData.facultyCode.toUpperCase(),
      };

      const docId = await FirestoreService.add("facultyCodes", newInstitution);
      console.log(`✅ Institución creada con ID: ${docId}`);

      // Update local state
      setInstitutions((prev) => [...prev, { ...newInstitution, id: docId }]);

      // Close modal
      setShowAddModal(false);
      setFormData({ institution: "", facultyCode: "" });
    } catch (error) {
      console.error("Error al crear institución:", error);
      setFormError(
        "Error al crear la institución. Por favor intenta de nuevo."
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Open Edit Modal
  const openEditModal = (institution: FacultyCodeWithId) => {
    setSelectedInstitution(institution);
    setFormData({
      institution: institution.institution,
      facultyCode: institution.facultyCode,
    });
    setFormError("");
    setShowEditModal(true);
  };

  // Handle Edit Institution
  const handleEditInstitution = async () => {
    if (!selectedInstitution) return;

    if (!formData.institution.trim()) {
      setFormError("El nombre de la institución es requerido");
      return;
    }

    if (!formData.facultyCode.trim() || formData.facultyCode.length !== 6) {
      setFormError("El código debe tener exactamente 6 caracteres");
      return;
    }

    if (!isCodeUnique(formData.facultyCode, selectedInstitution.id)) {
      setFormError("Este código ya está en uso");
      return;
    }

    setIsSaving(true);
    setFormError("");
    try {
      const updatedData = {
        institution: formData.institution.trim(),
        facultyCode: formData.facultyCode.toUpperCase(),
      };

      await FirestoreService.update(
        "facultyCodes",
        selectedInstitution.id,
        updatedData
      );
      console.log(
        `✅ Institución ${selectedInstitution.institution} actualizada`
      );

      // Update local state
      setInstitutions((prev) =>
        prev.map((inst) =>
          inst.id === selectedInstitution.id
            ? { ...inst, ...updatedData }
            : inst
        )
      );

      // Close modal
      setShowEditModal(false);
      setSelectedInstitution(null);
      setFormData({ institution: "", facultyCode: "" });
    } catch (error) {
      console.error("Error al actualizar institución:", error);
      setFormError(
        "Error al actualizar la institución. Por favor intenta de nuevo."
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Open Delete Modal
  const openDeleteModal = (institution: FacultyCodeWithId) => {
    setSelectedInstitution(institution);
    setShowDeleteModal(true);
  };

  // Handle Delete Institution
  const handleDeleteInstitution = async () => {
    if (!selectedInstitution) return;

    setIsDeleting(true);
    try {
      await FirestoreService.delete("facultyCodes", selectedInstitution.id);
      console.log(
        `✅ Institución ${selectedInstitution.institution} eliminada`
      );

      // Update local state
      setInstitutions((prev) =>
        prev.filter((inst) => inst.id !== selectedInstitution.id)
      );

      // Close modal
      setShowDeleteModal(false);
      setSelectedInstitution(null);
    } catch (error) {
      console.error("Error al eliminar institución:", error);
      alert("Error al eliminar la institución. Por favor intenta de nuevo.");
    } finally {
      setIsDeleting(false);
    }
  };

  const sortOptions = [
    {
      value: "alphabetical" as SortOption,
      label: "A-Z",
      icon: <FaSortAlphaDown />,
    },
    {
      value: "reverse-alphabetical" as SortOption,
      label: "Z-A",
      icon: <FaSortAlphaUp />,
    },
    {
      value: "code-asc" as SortOption,
      label: "Código ↑",
      icon: <FaKey />,
    },
    {
      value: "code-desc" as SortOption,
      label: "Código ↓",
      icon: <FaKey />,
    },
  ];

  return (
    <div className="p-12 font-montserrat-light w-full">
      <div className="p-0">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center mb-6 gap-4">
          <div className="flex flex-col items-start">
            <h1 className="text-4xl font-montserrat-bold">Instituciones</h1>
            <Link
              to="/admin"
              className="px-6 py-2 my-4 bg-glass border border-gray-600 rounded-lg text-[#f0f0f0] hover:border-[#d53137] hover:bg-gray-700 transition-colors flex items-center gap-2 font-medium"
            >
              <FaHome size={16} />
              Panel Admin
            </Link>
            <p className="text-gray-400">
              Total de instituciones: {institutions.length}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative">
              <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar instituciones o códigos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 bg-glass border border-gray-600 rounded-lg text-[#f0f0f0] focus:border-[#d53137] outline-none"
              />
            </div>
            <button
              onClick={openAddModal}
              className="cursor-pointer px-6 py-2 bg-[#d53137] hover:bg-[#b92830] text-white rounded-lg transition-colors flex items-center gap-2 font-medium"
            >
              <FaPlus />
              Agregar Institución
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-1 gap-4 mb-8">
          <div className="bg-glass p-4 rounded-lg border border-gray-700">
            <div className="flex items-center gap-3">
              <FaBuilding className="text-3xl text-blue-400" />
              <div>
                <div className="text-2xl font-montserrat-bold">
                  {institutions.length}
                </div>
                <div className="text-sm text-gray-400">
                  Instituciones registradas
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sort Options */}
        {!isLoading && institutions.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <span className="text-sm text-gray-300 font-medium">
              Ordenar por:
            </span>
            <div className="flex gap-2 flex-wrap">
              {sortOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleSortChange(option.value)}
                  className={`cursor-pointer px-4 py-2 rounded-lg flex items-center gap-2 text-sm transition-colors ${
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

        {isLoading && <Loader message="Cargando instituciones..." />}

        {/* Institutions Table */}
        {!isLoading && (
          <>
            {filteredInstitutions.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full bg-glass border border-gray-700 rounded-lg">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="px-6 py-4 text-left text-sm font-montserrat-bold text-gray-300">
                        Institución
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-montserrat-bold text-gray-300">
                        Código Faculty
                      </th>
                      <th className="px-6 py-4 text-center text-sm font-montserrat-bold text-gray-300">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInstitutions.map((institution, index) => (
                      <tr
                        key={institution.id}
                        className={`border-b border-gray-700 hover:bg-gray-800/50 transition-colors ${
                          index % 2 === 0 ? "bg-gray-900/20" : ""
                        }`}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-glass flex items-center justify-center flex-shrink-0">
                              <FaBuilding className="text-white" />
                            </div>
                            <div>
                              <p className="font-montserrat-bold text-white">
                                {institution.institution}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <FaKey className="text-gray-400" />
                            <span className="font-mono text-lg font-bold text-[#d53137]">
                              {institution.facultyCode}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex justify-center gap-2">
                            <button
                              onClick={() => openEditModal(institution)}
                              className="cursor-pointer px-4 py-2 bg-glass text-white rounded-lg transition-colors text-sm font-medium flex items-center gap-2"
                            >
                              <FaEdit />
                              Editar
                            </button>
                            <button
                              onClick={() => openDeleteModal(institution)}
                              className="cursor-pointer px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm font-medium flex items-center gap-2"
                            >
                              <FaTrash />
                              Eliminar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <FaBuilding className="mx-auto text-6xl text-gray-600 mb-4" />
                <p className="text-gray-400 text-lg">
                  {searchTerm.trim()
                    ? "No se encontraron instituciones con ese término de búsqueda"
                    : "No hay instituciones registradas"}
                </p>
              </div>
            )}
          </>
        )}

        {/* Add Modal */}
        {showAddModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
            onClick={() => setShowAddModal(false)}
          >
            <div
              className="bg-[#0f0f10] rounded-lg max-w-md w-full border border-gray-700"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-gray-700 flex items-center justify-between">
                <h2 className="text-2xl font-montserrat-bold">
                  Agregar Institución
                </h2>
                <button
                  aria-label="close"
                  onClick={() => setShowAddModal(false)}
                  className="cursor-pointer text-gray-400 hover:text-white text-2xl"
                >
                  <XButton />
                </button>
              </div>

              <div className="p-6 space-y-4">
                {formError && (
                  <div className="bg-red-900/20 border border-red-600 text-red-400 px-4 py-2 rounded-lg text-sm">
                    {formError}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Nombre de la Institución
                  </label>
                  <input
                    type="text"
                    value={formData.institution}
                    onChange={(e) =>
                      setFormData({ ...formData, institution: e.target.value })
                    }
                    placeholder="Ej: Colegio Rioclaro"
                    className="w-full px-4 py-2 bg-glass border border-gray-600 rounded-lg text-[#f0f0f0] focus:border-[#d53137] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Código Faculty
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={formData.facultyCode}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          facultyCode: e.target.value.toUpperCase(),
                        })
                      }
                      maxLength={6}
                      placeholder="6 caracteres"
                      className="flex-1 px-4 py-2 bg-glass border border-gray-600 rounded-lg text-[#f0f0f0] font-mono text-lg font-bold focus:border-[#d53137] outline-none"
                    />
                    <button
                      onClick={handleGenerateNewCode}
                      className="cursor-pointer px-4 py-2 bg-glass hover:bg-gray-700 border border-gray-600 rounded-lg transition-colors text-sm"
                    >
                      Generar
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Este código será usado por los facultys para registrarse
                  </p>
                </div>
              </div>

              <div className="p-6 border-t border-gray-700 flex justify-end gap-3">
                <button
                  onClick={() => setShowAddModal(false)}
                  disabled={isSaving}
                  className="cursor-pointer px-6 py-2 bg-glass hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleAddInstitution}
                  disabled={isSaving}
                  className="cursor-pointer px-6 py-2 bg-[#d53137] hover:bg-[#b92830] text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? "Guardando..." : "Agregar"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {showEditModal && selectedInstitution && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
            onClick={() => setShowEditModal(false)}
          >
            <div
              className="bg-[#0f0f10] rounded-lg max-w-md w-full border border-gray-700"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-gray-700 flex items-center justify-between">
                <h2 className="text-2xl font-montserrat-bold">
                  Editar Institución
                </h2>
                <button
                  aria-label="close"
                  onClick={() => setShowEditModal(false)}
                  className="cursor-pointer text-gray-400 hover:text-white text-2xl"
                >
                  <XButton />
                </button>
              </div>

              <div className="p-6 space-y-4">
                {formError && (
                  <div className="bg-red-900/20 border border-red-600 text-red-400 px-4 py-2 rounded-lg text-sm">
                    {formError}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Nombre de la Institución
                  </label>
                  <input
                    type="text"
                    value={formData.institution}
                    onChange={(e) =>
                      setFormData({ ...formData, institution: e.target.value })
                    }
                    placeholder="Ej: Colegio Rioclaro"
                    className="w-full px-4 py-2 bg-glass border border-gray-600 rounded-lg text-[#f0f0f0] focus:border-[#d53137] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Código Faculty
                  </label>
                  <input
                    type="text"
                    value={formData.facultyCode}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        facultyCode: e.target.value.toUpperCase(),
                      })
                    }
                    maxLength={6}
                    placeholder="6 caracteres"
                    className="w-full px-4 py-2 bg-glass border border-gray-600 rounded-lg text-[#f0f0f0] font-mono text-lg font-bold focus:border-[#d53137] outline-none"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    ⚠️ Cambiar el código puede afectar a los facultys ya
                    registrados
                  </p>
                </div>
              </div>

              <div className="p-6 border-t border-gray-700 flex justify-end gap-3">
                <button
                  onClick={handleEditInstitution}
                  disabled={isSaving}
                  className="cursor-pointer px-6 py-2 bg-[#d53137] hover:bg-[#a12227] text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? "Guardando..." : "Guardar Cambios"}
                </button>
                <button
                  onClick={() => setShowEditModal(false)}
                  disabled={isSaving}
                  className="cursor-pointer px-6 py-2 bg-glass hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteModal && selectedInstitution && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4"
            onClick={() => setShowDeleteModal(false)}
          >
            <div
              className="bg-[#0f0f10] rounded-lg max-w-md w-full border border-red-600"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-gray-700">
                <h2 className="text-2xl font-montserrat-bold text-red-400">
                  ⚠️ Confirmar eliminación
                </h2>
              </div>

              <div className="p-6">
                <p className="text-gray-300 mb-4">
                  ¿Estás seguro de que deseas eliminar esta institución?
                </p>
                <div className="bg-glass p-4 rounded-lg mb-4">
                  <p className="font-montserrat-bold text-white text-lg">
                    {selectedInstitution.institution}
                  </p>
                  <p className="text-sm text-gray-400 flex items-center gap-2 mt-2">
                    <FaKey className="text-gray-500" />
                    Código: {selectedInstitution.facultyCode}
                  </p>
                </div>
                <p className="text-sm text-red-400">
                  Esta acción no se puede deshacer. Los facultys con este código
                  ya no podrán usarlo para registrarse.
                </p>
              </div>

              <div className="p-6 border-t border-gray-700 flex justify-end gap-3">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  disabled={isDeleting}
                  className="cursor-pointer px-6 py-2 bg-glass hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDeleteInstitution}
                  disabled={isDeleting}
                  className="cursor-pointer px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isDeleting ? "Eliminando..." : "Eliminar institución"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InstitutionsManagement;
