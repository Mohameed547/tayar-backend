import shipmentService from "./shipments.service.js";
import ApiResponse from "../../shared/utils/ApiResponse.js";
import ApiError from "../../shared/utils/ApiError.js";

export const createShipment = async (req, res, next) => {
  try {
    const customerId = req.user._id;
    const shipment = await shipmentService.createShipment(customerId, req.body);

    return res
      .status(201)
      .json(ApiResponse.success(shipment, "Shipment created successfully"));
  } catch (err) {
    next(err);
  }
};

export const getMyShipments = async (req, res, next) => {
  try {
    const customerId = req.user._id;
    const { status, page, limit } = req.query;

    const statusFilter = status ? status.split(",") : null;

    const result = await shipmentService.getShipmentsByCustomer(
      customerId,
      statusFilter,
      { page, limit },
    );

    return res.status(200).json(ApiResponse.success(result));
  } catch (err) {
    next(err);
  }
};

export const getShipmentById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const userRole = req.user.role;

    // Only restrict query by customerId if user is a customer
    const customerId = userRole === "customer" ? userId : null;
    const shipment = await shipmentService.getShipmentById(id, customerId);

    if (!shipment) throw new ApiError(404, "Shipment not found");

    // Perform authorization check for driver / office roles
    if (userRole === "driver") {
      const isCaptain = shipment.captain && String(shipment.captain._id || shipment.captain) === String(userId);
      const isPending = shipment.status === "pending_offers";
      if (!isCaptain && !isPending) {
        throw new ApiError(403, "You are not authorized to view this shipment");
      }
    } else if (userRole === "office") {
      const OfficeModel = (await import("../../database/models/Office.js")).default;
      const office = await OfficeModel.findOne({ user: userId });
      const isOfficeAssigned = office && shipment.assignedOffice && String(shipment.assignedOffice) === String(office._id);
      const isPending = shipment.status === "pending_offers";
      if (!isOfficeAssigned && !isPending) {
        throw new ApiError(403, "You are not authorized to view this shipment");
      }
    }

    return res.status(200).json(ApiResponse.success(shipment));
  } catch (err) {
    next(err);
  }
};

export const cancelShipment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const customerId = req.user._id;

    const shipment = await shipmentService.cancelShipment(id, customerId);

    return res
      .status(200)
      .json(ApiResponse.success(shipment, "Shipment cancelled"));
  } catch (err) {
    next(err);
  }
};

export const getAvailableShipments = async (req, res, next) => {
    try {
        const { page, limit } = req.query;
        const result = await shipmentService.getAvailableShipments(
            req.user._id,
            req.user.role,
            { page, limit },
        );
        return res.status(200).json(ApiResponse.success(result));
    } catch (err) {
        next(err);
    }
};

export const getAllShipments = async (req, res, next) => {
  try {
    const { status, page, limit, search } = req.query;
    const statusFilter = status ? status.split(",") : null;
    const result = await shipmentService.getAllShipments(statusFilter, {
      page,
      limit,
      search,
    });
    return res.status(200).json(ApiResponse.success(result));
  } catch (err) {
    next(err);
  }
};
export const updateShipmentStatus = async (req, res, next) => {
  try {
    const shipment = await shipmentService.updateShipmentStatus(
      req.params.id,
      req.body.status,
    );
    return res
      .status(200)
      .json(ApiResponse.success(shipment, "Shipment status updated"));
  } catch (err) {
    next(err);
  }
};

export const getMyAssignedShipments = async (req, res, next) => {
    try {
        const { status, page, limit } = req.query;
        const result = await shipmentService.getMyAssignedShipments(
            req.user._id,
            req.user.role,
            { status, page, limit },
        );
        return res.status(200).json(ApiResponse.success(result));
    } catch (err) {
        next(err);
    }
};

export const acceptAssignment = async (req, res, next) => {
  try {
    const result = await shipmentService.acceptAssignment(req.params.id, req.user._id);
    return res.status(200).json(ApiResponse.success(result, "Assignment accepted successfully"));
  } catch (err) {
    next(err);
  }
};

export const rejectAssignment = async (req, res, next) => {
  try {
    const result = await shipmentService.rejectAssignment(req.params.id, req.user._id);
    return res.status(200).json(ApiResponse.success(result, "Assignment rejected successfully"));
  } catch (err) {
    next(err);
  }
};
