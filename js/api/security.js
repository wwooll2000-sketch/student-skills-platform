// Security Manager
class SecurityManager {
    constructor() {
        this.loginAttempts = {};
        this.maxAttempts = 5;
        this.lockoutTime = 900000;
    }

    checkLoginAttempts(identifier) {
        const now = Date.now();
        
        if (!this.loginAttempts[identifier]) {
            this.loginAttempts[identifier] = [];
        }

        this.loginAttempts[identifier] = this.loginAttempts[identifier].filter(
            timestamp => now - timestamp < this.lockoutTime
        );

        if (this.loginAttempts[identifier].length >= this.maxAttempts) {
            return {
                allowed: false,
                message: "تم تجاوز عدد محاولات الدخول. يرجى المحاولة لاحقاً"
            };
        }

        return { allowed: true };
    }

    recordFailedAttempt(identifier) {
        if (!this.loginAttempts[identifier]) {
            this.loginAttempts[identifier] = [];
        }
        this.loginAttempts[identifier].push(Date.now());
    }

    resetLoginAttempts(identifier) {
        delete this.loginAttempts[identifier];
    }
}

const securityManager = new SecurityManager();
