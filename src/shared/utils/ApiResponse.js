class ApiResponse {
    static success(data = null, message = "Success") {
        return {
            success: true,
            message,
            ...(data !== null && { data }),
        };
    }

    static send(res, statusCode, message, data = null) {
        const response = {
            success: statusCode >= 200 && statusCode < 300,
            message,
            ...(data !== null && { data })
        };
        return res.status(statusCode).json(response);
    }
}

export default ApiResponse;
