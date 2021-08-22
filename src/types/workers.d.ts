declare module "web-worker:*" {
    const WorkerFactory: new (options: any) => Worker;
    export default WorkerFactory;
}
