import { useState, useEffect, type FC } from "react";
import { Link } from "react-router-dom";
import {
  FaHome,
  FaGavel,
  FaSearch,
  FaCheckCircle,
  FaTimesCircle,
  FaUsers,
  FaToggleOn,
  FaToggleOff,
} from "react-icons/fa";
import { IoPerson } from "react-icons/io5";
import { FirestoreService } from "../../firebase/firestore";
import type { Committee } from "../../interfaces/Committee";
import Loader from "../../components/Loader";
import XButton from "../../components/XButton";

interface CommitteeWithId extends Committee {
  id: string;
}

// interface SeatItem {
//   name: string;
//   available: boolean;
// }

const SeatManagement: FC = () => {
  const [committees, setCommittees] = useState<CommitteeWithId[]>([]);
  const [filteredCommittees, setFilteredCommittees] = useState<
    CommitteeWithId[]
  >([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedCommittee, setSelectedCommittee] =
    useState<CommitteeWithId | null>(null);
  const [showSeatsModal, setShowSeatsModal] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const fetchCommittees = async () => {
    setIsLoading(true);
    try {
      const data = await FirestoreService.getAll<CommitteeWithId>("committees");
      setCommittees(data);
      console.log(`✅ ${data.length} comités cargados`);
    } catch (error) {
      console.error("Error fetching committees:", error);
      setCommittees([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCommittees();
  }, []);

  // Filter committees
  const filterCommittees = (
    committeesList: CommitteeWithId[],
    search: string
  ): CommitteeWithId[] => {
    if (!search.trim()) return committeesList;
    const searchLower = search.toLowerCase();
    return committeesList.filter(
      (committee) =>
        committee.name?.toLowerCase().includes(searchLower) ||
        committee.topic?.toLowerCase().includes(searchLower) ||
        committee.president?.toLowerCase().includes(searchLower)
    );
  };

  useEffect(() => {
    const filtered = filterCommittees(committees, searchTerm);
    setFilteredCommittees(filtered);
  }, [committees, searchTerm]);

  // Calculate stats
  const calculateStats = () => {
    let totalSeats = 0;
    let availableSeats = 0;
    let occupiedSeats = 0;

    committees.forEach((committee) => {
      totalSeats += committee.seats || 0;
      committee.seatsList?.forEach((seat) => {
        if (seat.available) {
          availableSeats++;
        } else {
          occupiedSeats++;
        }
      });
    });

    return { totalSeats, availableSeats, occupiedSeats };
  };

  const stats = calculateStats();

  // Open seats modal
  const openSeatsModal = (committee: CommitteeWithId) => {
    setSelectedCommittee(committee);
    setShowSeatsModal(true);
  };

  const closeSeatsModal = () => {
    setSelectedCommittee(null);
    setShowSeatsModal(false);
  };

  // Toggle seat availability
  const handleToggleSeat = async (seatIndex: number) => {
    if (!selectedCommittee || !selectedCommittee.id) return;

    const updatedSeatsList = selectedCommittee.seatsList.map((seat, index) =>
      index === seatIndex ? { ...seat, available: !seat.available } : seat
    );

    setIsSaving(true);
    try {
      await FirestoreService.update("committees", selectedCommittee.id, {
        seatsList: updatedSeatsList,
      });

      const updatedCommittee = {
        ...selectedCommittee,
        seatsList: updatedSeatsList,
      };
      setSelectedCommittee(updatedCommittee);
      setCommittees((prev) =>
        prev.map((c) => (c.id === selectedCommittee.id ? updatedCommittee : c))
      );

      console.log(
        `✅ Cupo "${updatedSeatsList[seatIndex].name}" actualizado a ${
          updatedSeatsList[seatIndex].available ? "disponible" : "ocupado"
        }`
      );
    } catch (error) {
      console.error("Error al actualizar cupo:", error);
      alert("Error al actualizar el cupo. Por favor intenta de nuevo.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleAllSeats = async (makeAvailable: boolean) => {
    if (!selectedCommittee || !selectedCommittee.id) return;

    const confirmMessage = makeAvailable
      ? "¿Deseas marcar TODOS los cupos como disponibles?"
      : "¿Deseas marcar TODOS los cupos como ocupados?";

    if (!window.confirm(confirmMessage)) return;

    const updatedSeatsList = selectedCommittee.seatsList.map((seat) => ({
      ...seat,
      available: makeAvailable,
    }));

    setIsSaving(true);
    try {
      await FirestoreService.update("committees", selectedCommittee.id, {
        seatsList: updatedSeatsList,
      });

      const updatedCommittee = {
        ...selectedCommittee,
        seatsList: updatedSeatsList,
      };
      setSelectedCommittee(updatedCommittee);
      setCommittees((prev) =>
        prev.map((c) => (c.id === selectedCommittee.id ? updatedCommittee : c))
      );

      console.log(
        `✅ Todos los cupos actualizados a ${
          makeAvailable ? "disponibles" : "ocupados"
        }`
      );
    } catch (error) {
      console.error("Error al actualizar cupos:", error);
      alert("Error al actualizar los cupos. Por favor intenta de nuevo.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-12 font-montserrat-light w-full">
      <div className="p-0">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center mb-6 gap-4">
          <div className="flex flex-col items-start">
            <h1 className="text-4xl font-montserrat-bold">Gestión de Cupos</h1>
            <Link
              to="/admin"
              className="cursor-pointer px-6 py-2 my-4 bg-glass border border-gray-600 rounded-lg text-[#f0f0f0] hover:border-[#d53137] hover:bg-gray-700 transition-colors flex items-center gap-2 font-medium"
            >
              <FaHome size={16} />
              Panel Admin
            </Link>
            <p className="text-gray-400">
              Gestiona la disponibilidad de cupos por comité
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative">
              <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar comités..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 bg-glass border border-gray-600 rounded-lg text-[#f0f0f0] focus:border-[#d53137] outline-none"
              />
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-glass p-4 rounded-lg border border-gray-700">
            <div className="flex items-center gap-3">
              <IoPerson className="text-3xl text-blue-400" />
              <div>
                <div className="text-2xl font-montserrat-bold">
                  {stats.totalSeats}
                </div>
                <div className="text-sm text-gray-400">Cupos totales</div>
              </div>
            </div>
          </div>

          <div className="bg-glass p-4 rounded-lg border border-gray-700">
            <div className="flex items-center gap-3">
              <FaCheckCircle className="text-3xl text-green-400" />
              <div>
                <div className="text-2xl font-montserrat-bold">
                  {stats.availableSeats}
                </div>
                <div className="text-sm text-gray-400">Cupos disponibles</div>
              </div>
            </div>
          </div>

          <div className="bg-glass p-4 rounded-lg border border-gray-700">
            <div className="flex items-center gap-3">
              <FaTimesCircle className="text-3xl text-red-400" />
              <div>
                <div className="text-2xl font-montserrat-bold">
                  {stats.occupiedSeats}
                </div>
                <div className="text-sm text-gray-400">Cupos ocupados</div>
              </div>
            </div>
          </div>
        </div>

        {isLoading && <Loader message="Cargando comités..." />}

        {/* Committees Table */}
        {!isLoading && (
          <>
            {filteredCommittees.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full bg-glass">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="px-6 py-4 text-left text-sm font-montserrat-bold text-gray-300">
                        Comité
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-montserrat-bold text-gray-300">
                        Presidente
                      </th>
                      <th className="px-6 py-4 text-center text-sm font-montserrat-bold text-gray-300">
                        Total Cupos
                      </th>
                      <th className="px-6 py-4 text-center text-sm font-montserrat-bold text-gray-300">
                        Disponibles
                      </th>
                      <th className="px-6 py-4 text-center text-sm font-montserrat-bold text-gray-300">
                        Ocupados
                      </th>
                      <th className="px-6 py-4 text-center text-sm font-montserrat-bold text-gray-300">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCommittees.map((committee, index) => {
                      const available =
                        committee.seatsList?.filter((s) => s.available)
                          .length || 0;
                      const occupied = (committee.seats || 0) - available;

                      return (
                        <tr
                          key={committee.id}
                          className={`border-b border-gray-700 hover:bg-gray-800/50 transition-colors ${
                            index % 2 === 0 ? "bg-gray-900/20" : ""
                          }`}
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-glass flex items-center justify-center flex-shrink-0">
                                <FaGavel className="text-white" />
                              </div>
                              <div>
                                <p className="font-montserrat-bold text-white">
                                  {committee.name}
                                </p>
                                <p className="text-xs text-gray-400">
                                  {committee.topic}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-gray-300">
                            {committee.president || "No asignado"}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className="text-lg font-montserrat-bold text-blue-400">
                              {committee.seats || 0}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className="text-lg font-montserrat-bold text-green-400">
                              {available}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className="text-lg font-montserrat-bold text-red-400">
                              {occupied}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <button
                              onClick={() => openSeatsModal(committee)}
                              className="cursor-pointer px-4 py-2 bg-glass text-white rounded-lg transition-colors text-sm font-medium flex items-center gap-2 mx-auto"
                            >
                              <FaUsers />
                              Gestionar Cupos
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <FaGavel className="mx-auto text-6xl text-gray-600 mb-4" />
                <p className="text-gray-400 text-lg">
                  {searchTerm.trim()
                    ? "No se encontraron comités con ese término de búsqueda"
                    : "No hay comités registrados"}
                </p>
              </div>
            )}
          </>
        )}

        {/* Seats Management Modal */}
        {showSeatsModal && selectedCommittee && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto"
            onClick={closeSeatsModal}
          >
            <div
              className="bg-glass max-h-[90%] overflow-auto rounded-lg max-w-4xl w-full my-8"
              onClick={(e) => e.stopPropagation()}
            >
              {/* header del modal*/}
              <div className="p-6 border-b border-gray-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-montserrat-bold">
                    Gestión de Cupos
                  </h2>
                  <p className="text-gray-400 text-sm mt-1">
                    {selectedCommittee.name}
                  </p>
                </div>
                {/* Estadísticas del comité */}
                <div className="flex gap-3">
                  <div className="bg-glass p-3 rounded-lg text-center min-w-[80px]">
                    <div className="text-xl font-montserrat-bold text-blue-400">
                      {selectedCommittee.seats || 0}
                    </div>
                    <div className="text-xs text-gray-400">Total</div>
                  </div>
                  <div className="bg-glass p-3 rounded-lg text-center min-w-[80px]">
                    <div className="text-xl font-montserrat-bold text-green-400">
                      {selectedCommittee.seatsList?.filter((s) => s.available)
                        .length || 0}
                    </div>
                    <div className="text-xs text-gray-400">Disponibles</div>
                  </div>
                  <div className="bg-glass p-3 rounded-lg text-center min-w-[80px]">
                    <div className="text-xl font-montserrat-bold text-red-400">
                      {selectedCommittee.seatsList?.filter((s) => !s.available)
                        .length || 0}
                    </div>
                    <div className="text-xs text-gray-400">Ocupados</div>
                  </div>
                </div>
                <button
                  aria-label="close"
                  onClick={closeSeatsModal}
                  className="cursor-pointer text-gray-400 hover:text-white text-2xl absolute top-4 right-6 sm:static sm:ml-4"
                >
                  <XButton />
                </button>
              </div>
              {/* Bulk actions */}
              <div className="p-6 border-b border-gray-700 flex gap-3 justify-center">
                <button
                  onClick={() => handleToggleAllSeats(true)}
                  disabled={isSaving}
                  className="cursor-pointer px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FaCheckCircle />
                  Marcar Todos Disponibles
                </button>
                <button
                  onClick={() => handleToggleAllSeats(false)}
                  disabled={isSaving}
                  className="cursor-pointer px-4 py-2 bg-[#d53137] hover:bg-[#b52a2f] text-white rounded-lg transition-colors text-sm font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FaTimesCircle />
                  Marcar Todos Ocupados
                </button>
              </div>

              {/* Seats list */}
              <div className="p-6 max-h-96 overflow-y-auto">
                {selectedCommittee.seatsList &&
                selectedCommittee.seatsList.length > 0 ? (
                  <div className="space-y-2">
                    {selectedCommittee.seatsList.map((seat, index) => (
                      <div
                        key={index}
                        className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
                          seat.available
                            ? "bg-green-900/20 border-green-600"
                            : "bg-red-900/20 border-red-600"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-3 h-3 rounded-full ${
                              seat.available ? "bg-green-400" : "bg-red-400"
                            }`}
                          />
                          <span className="font-medium text-white">
                            {seat.name}
                          </span>
                        </div>

                        <button
                          onClick={() => handleToggleSeat(index)}
                          disabled={isSaving}
                          className={`cursor-pointer px-4 py-2 rounded-lg transition-colors text-sm font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                            seat.available
                              ? "bg-[#d53137] hover:bg-[#b52a2f] text-white"
                              : "bg-green-600 hover:bg-green-700 text-white"
                          }`}
                        >
                          {seat.available ? (
                            <>
                              <FaToggleOff />
                              Marcar Ocupado
                            </>
                          ) : (
                            <>
                              <FaToggleOn />
                              Marcar Disponible
                            </>
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <IoPerson className="mx-auto text-4xl text-gray-600 mb-2" />
                    <p className="text-gray-400">
                      No hay cupos registrados para este comité
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SeatManagement;
