using Microsoft.OpenApi.Models;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace TabHub.API.API.Swagger;

public class TenantHeaderOperationFilter : IOperationFilter
{
    public void Apply(OpenApiOperation operation, OperationFilterContext context)
    {
        operation.Parameters.Add(new OpenApiParameter
        {
            Name = "X-Tenant",
            In = ParameterLocation.Header,
            Required = true,
            Description = "Tenant slug (e.g. cafetunisia, restauranttunisia)",
            Schema = new OpenApiSchema { Type = "string" },
        });
    }
}
