import { type FC, useRef, useState, useEffect } from "react";
import { z } from "zod";
import { paymentInformation } from "../config/paymentInfo";
import type { RegistrationForm } from "../interfaces/RegistrationForm";
import type { Committee } from "../interfaces/Committee";
import { FaCheck } from "react-icons/fa6";
import Loader from "./Loader";
import { PDFGenerator } from "./PDFGenerator";
import { FirestoreService } from "../firebase/firestore";

const step1Schema = z.object({
  seats: z
    .number()
    .min(1, "Debe seleccionar al menos 1 cupo")
    .max(30, "No puede seleccionar más de 30 cupos"),
});

const step2Schema = z
  .object({
    seats: z.number().min(1),
    seatsRequested: z
      .array(z.string())
      .min(1, "Debe seleccionar al menos un asiento"),
    requiresBackup: z.boolean(),
    backupSeatsRequested: z.array(z.string()),
  })
  .superRefine((data, ctx) => {
    if (data.seatsRequested.length > data.seats) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["seatsRequested"],
        message:
          "No puede seleccionar más asientos principales de los cupos solicitados",
      });
    }

    if (data.requiresBackup) {
      const maxBackupSeats = data.seats * 2;
      if (data.backupSeatsRequested.length > maxBackupSeats) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["backupSeatsRequested"],
          message: `No puede seleccionar más de ${maxBackupSeats} cupos de respaldo (máximo 2 por cupo solicitado)`,
        });
      }
    }
  });

const step3Schema = z.object({
  paymentMethod: z.string().min(1, "Debe seleccionar un método de pago"),
});

const step4Schema = z.object({
  transactionId: z
    .string()
    .min(1, "El número de referencia es requerido")
    .min(4, "El número de referencia debe tener al menos 4 caracteres"),
  paymentMethod: z.string().min(1),
});

const finalSchema = z.object({
  seats: z.number().min(1, "Debe seleccionar al menos 1 cupo"),
  seatsRequested: z
    .array(z.string())
    .min(1, "Debe seleccionar al menos un asiento"),
  paymentMethod: z.string().min(1, "Debe seleccionar un método de pago"),
  transactionId: z.string().min(1, "El número de referencia es requerido"),
});

interface CarousselProps {
  slides: number;
  currentStep: number;
  paymentMethods?: string[];
  formData?: RegistrationForm;
  setFormData: React.Dispatch<React.SetStateAction<RegistrationForm>>;
  setCurrentStep: (step: number) => void;
}

const Caroussel: FC<CarousselProps> = ({
  slides,
  currentStep,
  paymentMethods,
  formData,
  setFormData,
  setCurrentStep,
}) => {
  const [errors, setErrors] = useState<Record<string, string>>({}),
    [isSubmitting, setIsSubmitting] = useState<boolean>(false),
    [isLoading, setIsLoading] = useState<boolean>(false);

  const [committees, setCommittees] = useState<Committee[]>([]);
  const [committeesLoading, setCommitteesLoading] = useState<boolean>(true);
  const [committeesError, setCommitteesError] = useState<string>("");

  const rate = useRef(180);

  const fetchCommittees = async () => {
    setCommitteesLoading(true);
    setCommitteesError("");
    try {
      console.log("🔄 Cargando comités desde Firestore...");
      const data = await FirestoreService.getAll<Committee>("committees");

      const availableCommittees = data.filter(
        (committee) => committee.seatsList && committee.seatsList.length > 0
      );

      setCommittees(availableCommittees);
      console.log("✅ Comités cargados:", availableCommittees.length);
    } catch (error) {
      console.error("❌ Error cargando comités:", error);
      setCommitteesError(
        "Error cargando los comités. Por favor, recarga la página."
      );
    } finally {
      setCommitteesLoading(false);
    }
  };

  useEffect(() => {
    fetchCommittees();
  }, []);

  const validateCurrentStep = (): boolean => {
    try {
      let schema;

      switch (currentStep) {
        case 1:
          schema = step1Schema;
          break;
        case 2:
          schema = step2Schema;
          break;
        case 3:
          schema = step3Schema;
          break;
        case 4:
          schema = step4Schema;
          break;
        default:
          return true;
      }

      schema.parse(formData!);
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const formattedErrors: Record<string, string> = {};
        error.issues.forEach((issue) => {
          if (issue.path[0]) {
            formattedErrors[issue.path[0] as string] = issue.message;
          }
        });
        setErrors(formattedErrors);
      }
      return false;
    }
  };

  const validateFullForm = (): boolean => {
    try {
      finalSchema.parse(formData!);
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const formattedErrors: Record<string, string> = {};
        error.issues.forEach((issue) => {
          if (issue.path[0]) {
            formattedErrors[issue.path[0] as string] = issue.message;
          }
        });
        setErrors(formattedErrors);
      }
      return false;
    }
  };

  const handleSeatsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const seatsValue = parseInt(e.target.value) || 0;

    setFormData!((prev) => ({
      ...prev,
      seats: seatsValue,
      independentDelegate: seatsValue === 1,
      isBigGroup: seatsValue >= 13,
    }));

    if (errors.seats) {
      setErrors((prev) => ({
        ...prev,
        seats: "",
      }));
    }
  };

  const handleSeatSelection = (
    committee: string,
    seatName: string,
    isChecked: boolean
  ) => {
    const uniqueSeat = `${committee} - ${seatName}`;

    setFormData!((prev) => {
      const newSeatsRequested = isChecked
        ? [...prev.seatsRequested, uniqueSeat]
        : prev.seatsRequested.filter((s) => s !== uniqueSeat);

      return {
        ...prev,
        seatsRequested: newSeatsRequested,
      };
    });

    if (errors.seatsRequested) {
      setErrors((prev) => ({
        ...prev,
        seatsRequested: "",
      }));
    }
  };

  const handlePaymentMethod = (method: string) => {
    setFormData!((prev) => ({
      ...prev,
      paymentMethod: method,
    }));

    if (errors.paymentMethod) {
      setErrors((prev) => ({
        ...prev,
        paymentMethod: "",
      }));
    }
  };

  const handleTransactionIdChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = e.target.value;
    setFormData!((prev) => ({
      ...prev,
      transactionId: value,
    }));

    if (errors.transactionId) {
      setErrors((prev) => ({
        ...prev,
        transactionId: "",
      }));
    }
  };

  const handleBackupToggle = (enabled: boolean) => {
    setFormData!((prev) => ({
      ...prev,
      requiresBackup: enabled,
      backupSeatsRequested: enabled ? prev.backupSeatsRequested : [],
    }));
  };

  const handleBackupSeatSelection = (
    committee: string,
    seatName: string,
    isChecked: boolean
  ) => {
    const uniqueSeat = `${committee} - ${seatName}`;

    setFormData!((prev) => {
      const newBackupSeatsRequested = isChecked
        ? [...prev.backupSeatsRequested, uniqueSeat]
        : prev.backupSeatsRequested.filter((s) => s !== uniqueSeat);

      return {
        ...prev,
        backupSeatsRequested: newBackupSeatsRequested,
      };
    });

    if (errors.backupSeatsRequested) {
      setErrors((prev) => ({
        ...prev,
        backupSeatsRequested: "",
      }));
    }
  };

  const slideContent = [
    {
      title: "Seleccionar cupos",
      content: (
        <div className="text-center">
          <h3 className="text-xl mb-4">¿Cuántos cupos deseas reservar?</h3>

          {errors.seats && (
            <div className="bg-red-500/20 border border-red-500 text-red-200 px-4 py-2 rounded mb-4">
              {errors.seats}
            </div>
          )}

          <label aria-label="cupos" htmlFor="cupos">
            <input
              className={`bg-glass p-4 text-4xl font-montserrat-bold text-center rounded-lg ${
                errors.seats ? "border border-red-500" : ""
              }`}
              type="number"
              id="cupos"
              min="1"
              max="30"
              value={formData!.seats || ""}
              onChange={handleSeatsChange}
              placeholder="0"
            />
          </label>
          <p className="mt-2 text-sm text-gray-300">
            Inscripción por:
            {formData!.seats > 0 && (
              <span className="block mt-1 font-montserrat-bold">
                {formData!.independentDelegate
                  ? "Delegado independiente"
                  : formData!.isBigGroup
                  ? "Delegación grande"
                  : "Delegación pequeña"}
              </span>
            )}
          </p>
        </div>
      ),
    },
    {
      title: "Seleccionar cupos",
      content: (
        <div className="w-full">
          <h3 className="text-center py-2">
            Cupos seleccionados: {formData!.seatsRequested.length} /{" "}
            {formData!.seats}
            {formData!.requiresBackup && (
              <span className="block text-sm text-gray-400">
                Respaldo: {formData!.backupSeatsRequested.length} /{" "}
                {formData!.seats * 2}
              </span>
            )}
          </h3>

          <label className="cursor-pointer w-fit justify-self-center text-sm font-montserrat-light flex items-center justify-center gap-2 p-4">
            <input
              type="checkbox"
              checked={formData!.requiresBackup}
              onChange={(e) => handleBackupToggle(e.target.checked)}
              className="w-4 h-4 text-blue-600 cursor-pointer bg-glass border-gray-600 rounded focus:ring-blue-500"
            />
            <p>Cupos de respaldo</p>
          </label>

          {errors.seatsRequested && (
            <div className="bg-red-500/20 border border-red-500 text-red-200 px-4 py-2 rounded mb-4 text-center">
              {errors.seatsRequested}
            </div>
          )}

          {errors.backupSeatsRequested && (
            <div className="bg-red-500/20 border border-red-500 text-red-200 px-4 py-2 rounded mb-4 text-center">
              {errors.backupSeatsRequested}
            </div>
          )}

          {committeesError && (
            <div className="bg-red-500/20 border border-red-500 text-red-200 px-4 py-2 rounded mb-4 text-center">
              {committeesError}
              <button
                onClick={fetchCommittees}
                className="ml-2 underline hover:no-underline"
              >
                Reintentar
              </button>
            </div>
          )}

          {committeesLoading ? (
            <div className="flex justify-center items-center py-12">
              <Loader message="Cargando comités..." />
            </div>
          ) : committees.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-lg mb-4">No hay comités disponibles</p>
              <button
                onClick={fetchCommittees}
                className="bg-[#d53137] text-white px-4 py-2 rounded hover:bg-[#b71c1c] transition-colors"
              >
                Recargar comités
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-h-[400px] overflow-y-auto">
              {committees.map((committee) => (
                <div
                  key={committee.name}
                  className="bg-glass/50 p-2 rounded-lg"
                >
                  <img
                    src={committee.img}
                    alt={committee.name}
                    className="w-full h-48 object-contain mb-2"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDJMMTMuMDkgOC4yNkwyMCA5TDEzLjA5IDE1Ljc0TDEyIDIyTDEwLjkxIDE1Ljc0TDQgOUwxMC45MSA4LjI2TDEyIDJaIiBmaWxsPSIjNjY2Ii8+Cjwvc3ZnPgo=";
                    }}
                  />
                  <h4 className="font-montserrat-bold mb-2 text-center min-h-[40px] flex items-center justify-center">
                    {committee.name}
                  </h4>

                  <div className="text-center">
                    <span className="text-sm text-gray-300">
                      Cupos disponibles:
                      {
                        committee.seatsList.filter(
                          (seat) =>
                            seat.available &&
                            !formData!.seatsRequested.includes(
                              `${committee.name} - ${seat.name}`
                            ) &&
                            !formData!.backupSeatsRequested.includes(
                              `${committee.name} - ${seat.name}`
                            )
                        ).length
                      }
                    </span>
                  </div>

                  <div className="grid grid-cols-2 space-y-2 max-h-[800px] overflow-y-auto">
                    {committee.seatsList.map((seat, index) => {
                      const uniqueSeat = `${committee.name} - ${seat.name}`;
                      const isSelected =
                        formData!.seatsRequested.includes(uniqueSeat);
                      const isBackupSelected =
                        formData!.backupSeatsRequested.includes(uniqueSeat);

                      return (
                        <div
                          key={`${committee.name}-${seat.name}-${index}`}
                          className="space-y-1"
                        >
                          <label
                            className={`flex items-center gap-2 py-1 text-sm cursor-pointer hover:bg-black/20 p-1 rounded transition-colors ${
                              !seat.available || isBackupSelected
                                ? "opacity-50 cursor-not-allowed"
                                : ""
                            }`}
                          >
                            <input
                              type="checkbox"
                              name={`${committee.name}-seats`}
                              value={uniqueSeat}
                              checked={isSelected}
                              disabled={!seat.available || isBackupSelected}
                              onChange={(e) =>
                                handleSeatSelection(
                                  committee.name,
                                  seat.name,
                                  e.target.checked
                                )
                              }
                              className="w-3 h-3 text-blue-600 cursor-pointer bg-glass border-gray-600 rounded focus:ring-gray-400 focus:ring-1 disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                            <span
                              className={`font-montserrat-light transition-all duration-200 ${
                                !seat.available
                                  ? "text-gray-600 line-through"
                                  : isSelected
                                  ? "text-green-400 font-montserrat-bold"
                                  : "text-[#f0f0f0]"
                              }`}
                            >
                              {seat.name}
                              {!seat.available && (
                                <span className="ml-1 text-xs text-red-400">
                                  (No disponible)
                                </span>
                              )}
                            </span>
                          </label>

                          {formData!.requiresBackup && (
                            <label
                              className={`flex items-center gap-2 py-1 text-xs cursor-pointer hover:bg-black/20 p-1 rounded transition-colors ml-4 ${
                                (!seat.available || isSelected) &&
                                !isBackupSelected
                                  ? "opacity-50 cursor-not-allowed"
                                  : ""
                              }`}
                            >
                              <input
                                type="checkbox"
                                name={`${committee.name}-backup-seats`}
                                value={uniqueSeat}
                                checked={isBackupSelected}
                                disabled={
                                  ((!seat.available || isSelected) &&
                                    !isBackupSelected) ||
                                  (formData!.backupSeatsRequested.length >=
                                    formData!.seats * 2 &&
                                    !isBackupSelected)
                                }
                                onChange={(e) =>
                                  handleBackupSeatSelection(
                                    committee.name,
                                    seat.name,
                                    e.target.checked
                                  )
                                }
                                className="w-3 h-3 text-orange-600 cursor-pointer bg-glass border-gray-600 rounded focus:ring-orange-400 focus:ring-1 disabled:opacity-50 disabled:cursor-not-allowed"
                              />
                              <span
                                className={`font-montserrat-light transition-all duration-200 ${
                                  isBackupSelected
                                    ? "text-orange-400 font-montserrat-bold"
                                    : "text-gray-400"
                                }`}
                              >
                                {seat.name} (respaldo)
                              </span>
                            </label>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ),
    },
    {
      title: "Método de pago",
      content: (
        <div className="text-center">
          <h3 className="text-xl font-montserrat-light mb-4">
            ¿Cómo deseas pagar?
          </h3>

          {errors.paymentMethod && (
            <div className="bg-red-500/20 border border-red-500 text-red-200 px-4 py-2 rounded mb-4">
              {errors.paymentMethod}
            </div>
          )}

          <div className="space-y-4 flex flex-col items-center gap-4">
            {paymentMethods?.map((method) => (
              <button
                key={method}
                onClick={() => handlePaymentMethod(method)}
                className={`cursor-pointer relative block w-[80%] max-w-sm px-4 py-3 rounded-lg transition-all duration-200 ${
                  formData!.paymentMethod === method
                    ? "bg-[#f0f0f0] text-[#242424] font-montserrat-bold"
                    : "bg-glass"
                } ${errors.paymentMethod ? "border border-red-500" : ""}`}
              >
                {formData!.paymentMethod === method && (
                  <FaCheck className="absolute left-[5%] top-1/2 transform -translate-y-1/2 text-[#242424]" />
                )}
                {method}
              </button>
            ))}
          </div>
        </div>
      ),
    },
    {
      title: "Validar pago",
      content: (
        <div>
          {/* Mostrar errores si existen */}
          {errors.transactionId && (
            <div className="bg-red-500/20 border border-red-500 text-red-200 px-4 py-2 rounded mb-4">
              {errors.transactionId}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mx-auto">
            <div className="bg-glass/30 p-6 rounded-lg">
              <div className="mb-6 pb-4 border-b border-gray-600">
                <h4 className="font-montserrat-bold mb-3 text-lg">
                  Información del Usuario
                </h4>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-montserrat-bold">Nombre:</span>
                    <span className="ml-2 text-gray-300">
                      {formData!.userFirstName} {formData!.userLastName}
                    </span>
                  </div>
                  <div>
                    <span className="font-montserrat-bold">Correo:</span>
                    <span className="ml-2 text-gray-300">
                      {formData!.userEmail}
                    </span>
                  </div>
                  <div>
                    <span className="font-montserrat-bold">Institución:</span>
                    <span className="ml-2 text-gray-300">
                      {formData!.userInstitution}
                    </span>
                  </div>
                  <div>
                    <span className="font-montserrat-bold">Tipo:</span>
                    <span className="ml-2 text-gray-300">
                      {formData!.userIsFaculty ? "Faculty" : "Estudiante"}
                    </span>
                  </div>
                </div>
              </div>

              <h4 className="font-montserrat-bold mb-4 text-lg">
                Resumen de inscripción
              </h4>

              <div className="space-y-3 text-sm">
                <div>
                  <p className="font-montserrat-bold">Cupos solicitados:</p>
                  <p className="text-gray-300">{formData!.seats}</p>
                </div>

                <div>
                  <p className="font-montserrat-bold mb-2">
                    Cupos principales:
                  </p>
                  <div className="max-h-32 overflow-y-auto bg-glass p-2 rounded">
                    {formData!.seatsRequested.length > 0 ? (
                      <ul className="text-xs space-y-1">
                        {formData!.seatsRequested.map((seat, index) => (
                          <li key={index} className="text-green-300 py-1">
                            • {seat}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-gray-400">
                        No hay cupos principales seleccionados
                      </p>
                    )}
                  </div>
                </div>

                {formData!.requiresBackup &&
                  formData!.backupSeatsRequested.length > 0 && (
                    <div>
                      <p className="font-montserrat-bold mb-2">
                        Cupos de respaldo:
                      </p>
                      <div className="max-h-32 overflow-y-auto bg-glass p-2 rounded">
                        <ul className="text-xs space-y-1">
                          {formData!.backupSeatsRequested.map((seat, index) => (
                            <li key={index} className="text-orange-300 py-1">
                              • {seat}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}

                <div>
                  <p className="font-montserrat-bold">Método de pago:</p>
                  <p className="text-gray-300">
                    {formData!.paymentMethod || "No seleccionado"}
                  </p>
                </div>

                <div className="flex justify-between font-montserrat-bold text-base pt-2 border-t border-[#282828]">
                  <span>Total a pagar:</span>
                  <span className="text-green-400">
                    $
                    {(() => {
                      const cuposCost = formData!.seatsRequested.length * 10;
                      const delegationFee = formData!.independentDelegate
                        ? 0
                        : formData!.isBigGroup
                        ? 30
                        : 20;

                      formData!.amount = Number(
                        (cuposCost + delegationFee).toFixed(2)
                      );
                      return formData!.amount;
                    })()}
                  </span>
                </div>
                <span className="text-sm text-right font-montserrat-bold">
                  <p>Bs. {(formData!.amount * rate.current).toFixed(2)}</p>
                </span>

                <div className="mt-4 pt-3 border-t border-[#282828]">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>
                        Cupos ({formData!.seatsRequested.length} × $10.00):
                      </span>
                      <span>
                        ${(formData!.seatsRequested.length * 10).toFixed(2)}
                      </span>
                    </div>

                    {!formData!.independentDelegate && (
                      <div className="flex justify-between text-sm">
                        <span>
                          Tarifa de delegación (
                          {formData!.isBigGroup ? "grande" : "pequeña"}):
                        </span>
                        <span>${formData!.isBigGroup ? "30.00" : "20.00"}</span>
                      </div>
                    )}
                  </div>

                  {formData!.paymentMethod !== "Efectivo" && (
                    <div className="mt-4">
                      <label
                        htmlFor="transactionId"
                        className="font-montserrat-bold block mb-2"
                      >
                        Número de referencia / confirmación:
                      </label>
                      <input
                        id="transactionId"
                        type="text"
                        value={formData!.transactionId}
                        onChange={handleTransactionIdChange}
                        placeholder={
                          paymentInformation.find(
                            (info) => info.method === formData!.paymentMethod
                          )?.placeholder || "Ej: 1234567890"
                        }
                        className={`w-full px-3 py-2 rounded bg-glass border text-[#f0f0f0] font-montserrat-light focus:outline-none focus:ring-2 ${
                          errors.transactionId
                            ? "border-red-500 focus:ring-red-500"
                            : "border-gray-600 focus:ring-blue-500"
                        }`}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="px-6 rounded-lg h-fit">
              <h4 className="font-montserrat-bold mb-4 text-lg">
                Información de pago
              </h4>

              {formData!.paymentMethod ? (
                (() => {
                  const paymentInfo = paymentInformation.find(
                    (info) => info.method === formData!.paymentMethod
                  );

                  if (!paymentInfo) return null;

                  return (
                    <div className="space-y-3 text-sm flex flex-col items-start">
                      {Object.entries(paymentInfo.data).map(([key, value]) => (
                        <div key={key}>
                          <p className="font-montserrat-bold">{key}:</p>
                          {key === "QR" ? (
                            <img
                              src={value}
                              alt="Código QR para pago móvil"
                              className="w-54 h-54 object-contain bg-white rounded-lg mx-auto my-2"
                            />
                          ) : (
                            <p className="text-gray-300">{value}</p>
                          )}
                        </div>
                      ))}

                      <div
                        className={
                          paymentInfo.messageColor === "blue"
                            ? "mt-4 p-3 bg-blue-500/20 rounded-lg"
                            : paymentInfo.messageColor === "green"
                            ? "mt-4 p-3 bg-green-500/20 rounded-lg"
                            : paymentInfo.messageColor === "purple"
                            ? "mt-4 p-3 bg-purple-500/20 rounded-lg"
                            : paymentInfo.messageColor === "orange"
                            ? "mt-4 p-3 bg-orange-500/20 rounded-lg"
                            : "mt-4 p-3 bg-gray-500/20 rounded-lg"
                        }
                      >
                        <p
                          className={
                            paymentInfo.messageColor === "blue"
                              ? "text-xs text-blue-200"
                              : paymentInfo.messageColor === "green"
                              ? "text-xs text-green-200"
                              : paymentInfo.messageColor === "purple"
                              ? "text-xs text-purple-200"
                              : paymentInfo.messageColor === "orange"
                              ? "text-xs text-orange-200"
                              : "text-xs text-gray-200"
                          }
                        >
                          {paymentInfo.message}
                        </p>
                      </div>
                    </div>
                  );
                })()
              ) : (
                <div className="text-center text-gray-400">
                  <p>Selecciona un método de pago para ver los detalles</p>
                </div>
              )}
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "Finalizado",
      content: (
        <div className="text-center space-y-6">
          <h3 className="text-xl font-montserrat-bold mb-4 text-green-400">
            ¡Inscripción completada!
          </h3>
          <p className="font-montserrat-light">
            Revisa tu correo para más detalles.
          </p>
          <div className="mt-4 text-sm text-gray-300">
            <p>ID de transacción: {formData!.transactionId || "Pendiente"}</p>
          </div>

          <div className="mt-6">
            <button
              onClick={() => PDFGenerator.downloadPDF(formData!)}
              className="bg-[#d53137] text-white px-6 py-3 rounded-lg hover:bg-[#b71c1c] transition-colors flex items-center gap-2 mx-auto"
            >
              📄 Descargar Comprobante
            </button>
          </div>
        </div>
      ),
    },
  ];

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setIsLoading(true);
    try {
      if (!validateFullForm()) {
        setIsSubmitting(false);
        setIsLoading(false);
        return;
      }

      console.log("Formulario enviado:", formData!);

      let pdfUrl = "";
      try {
        pdfUrl = await PDFGenerator.uploadAndDownloadPDF(formData!);
        console.log("PDF subido a Supabase:", pdfUrl);

        setFormData!((prev) => ({ ...prev, pdfUrl }));
      } catch (pdfError) {
        console.error("Error subiendo PDF:", pdfError);
      }

      await new Promise((resolve) => setTimeout(resolve, 2000));

      await FirestoreService.add("registrations", {
        ...formData!,
        pdfUrl,
        createdAt: new Date().toISOString(),
      });

      console.log("Inscripción completada exitosamente");
    } catch (error) {
      console.error("Error al enviar el formulario:", error);
      setErrors({
        submit: "Error al procesar la inscripción. Intenta nuevamente.",
      });
    } finally {
      setIsSubmitting(false);
      setIsLoading(false);
      handleNext();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleNext = () => {
    if (currentStep < slides) {
      if (validateCurrentStep()) {
        setCurrentStep(currentStep + 1);
      }
      return;
    }

    handleSubmit();
  };

  return (
    <div className="bg-glass w-full my-8 sm:px-12 py-8 rounded-lg font-montserrat-light">
      {isLoading ? (
        <Loader message="Validando..." />
      ) : (
        <>
          <div className="min-h-[60vh] sm:max-h-[900px] md:max-h-[1200px] flex flex-col justify-center items-center">
            <div
              className="w-full transition-all duration-500 ease-in-out"
              key={currentStep}
            >
              {slideContent[currentStep - 1]?.content}
            </div>
          </div>

          {errors.submit && (
            <div className="bg-red-500/20 border border-red-500 text-red-200 px-4 py-2 rounded mt-4">
              {errors.submit}
            </div>
          )}

          <div className="flex flex-col sm:flex-row justify-between  gap-4 mt-12 w-full">
            <button
              onClick={
                currentStep === 1
                  ? () => (window.location.href = "/")
                  : handlePrevious
              }
              className="cursor-pointer px-6 py-2 mx-8 sm:mx-0 bg-glass font-montserrat-light rounded-lg transition-all duration-200 hover:bg-opacity-80"
            >
              {currentStep === 1 ? "Volver a inicio" : "Anterior"}
            </button>

            <button
              onClick={
                currentStep === slides
                  ? () => (window.location.href = "/")
                  : currentStep === 4 && formData?.paymentMethod === "Efectivo"
                  ? () => (window.location.href = "/")
                  : currentStep === 4
                  ? handleSubmit
                  : handleNext
              }
              disabled={isSubmitting}
              className={`cursor-pointer px-6 py-2 mx-8 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-opacity-80
                ${
                  currentStep === 4
                    ? formData?.paymentMethod === "Efectivo"
                      ? "bg-[#f0f0f0] text-[#242424] font-montserrat-bold hover:bg-yellow-600 hover:text-[#f0f0f0]"
                      : "bg-[#f0f0f0] text-[#242424] font-montserrat-bold hover:bg-yellow-600 hover:text-[#f0f0f0]"
                    : "bg-glass font-montserrat-light "
                }
              `}
            >
              {currentStep === slides
                ? "Terminar"
                : currentStep === 4 && formData?.paymentMethod === "Efectivo"
                ? "Terminar"
                : currentStep === 4
                ? "Pagar"
                : "Siguiente"}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default Caroussel;
