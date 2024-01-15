export class EnvironmentManager {
	static getDb() {
		return process.env.DATABASE!;
	}

	static getStage ()
	{
		return process.env.STAGE!;
	}
}
