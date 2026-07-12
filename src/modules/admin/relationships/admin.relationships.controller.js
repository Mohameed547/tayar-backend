import adminRelationshipsService from "./admin.relationships.service.js";
import ApiResponse from "../../../shared/utils/ApiResponse.js";

export const getOffices = async (req, res, next) => {
  try {
    const data = await adminRelationshipsService.getOffices();
    return res.status(200).json(ApiResponse.success(data));
  } catch (err) {
    next(err);
  }
};

export const getCaptains = async (req, res, next) => {
  try {
    const data = await adminRelationshipsService.getCaptains();
    return res.status(200).json(ApiResponse.success(data));
  } catch (err) {
    next(err);
  }
};

export const getRelationships = async (req, res, next) => {
  try {
    const { status } = req.query;
    const data = await adminRelationshipsService.getRelationships(status);
    return res.status(200).json(ApiResponse.success(data));
  } catch (err) {
    next(err);
  }
};

export const getRemovedCaptains = async (req, res, next) => {
  try {
    const data = await adminRelationshipsService.getRemovedCaptains();
    return res.status(200).json(ApiResponse.success(data));
  } catch (err) {
    next(err);
  }
};

export const getSuspendedCaptains = async (req, res, next) => {
  try {
    const data = await adminRelationshipsService.getSuspendedCaptains();
    return res.status(200).json(ApiResponse.success(data));
  } catch (err) {
    next(err);
  }
};

export const getInvitationHistory = async (req, res, next) => {
  try {
    const data = await adminRelationshipsService.getInvitationHistory();
    return res.status(200).json(ApiResponse.success(data));
  } catch (err) {
    next(err);
  }
};

export const getAuditLogs = async (req, res, next) => {
  try {
    const data = await adminRelationshipsService.getAuditLogs();
    return res.status(200).json(ApiResponse.success(data));
  } catch (err) {
    next(err);
  }
};
