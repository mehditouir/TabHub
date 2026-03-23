using System.Net;
using System.Text.Json;

namespace TabHub.API.Infrastructure.Middleware;

/// <summary>
/// Catches any unhandled exception that escapes the controller pipeline and returns
/// a structured JSON 500 response instead of the default HTML error page.
/// </summary>
public class ExceptionMiddleware(RequestDelegate next, ILogger<ExceptionMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Unhandled exception on {Method} {Path}",
                context.Request.Method, context.Request.Path);

            if (context.Response.HasStarted)
                return; // Cannot write headers once streaming has started

            context.Response.StatusCode  = (int)HttpStatusCode.InternalServerError;
            context.Response.ContentType = "application/json";

            var body = JsonSerializer.Serialize(new { error = "An unexpected error occurred." });
            await context.Response.WriteAsync(body);
        }
    }
}
