class ApiResponse {
    static send(res, statusCode, message, data = null) {
        const response = {
            success: statusCode >= 200 && statusCode < 300,
            message,
            ...(data && { data })
        };
        return res.status(statusCode).json(response);
    }
}

export default ApiResponse;