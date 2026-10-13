const handleRequestTrial = async () => {
    setError(null);
    setTrialLoading(true);
    setLoading(true);
    setStage({ s: "connecting", d: "Criando seu teste de 3 horas..." });

    try {
      const device = getDeviceHardware();

      const response = await fetch(SUPABASE_TRIAL_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mac: device.mac,
          device_key: device.key,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Não foi possível ativar o teste.");
      }

      setUser(data.username);
      setPass(data.password);
      const targetServer = data.serverUrl || server;
      setServer(targetServer);

      // Aguarda 6 segundos para o servidor do painel registrar a conta
      setStage({ s: "validating", d: "Sincronizando conta no servidor..." });
      await new Promise((resolve) => setTimeout(resolve, 6000));

      // Tenta conectar até 4 vezes com intervalo de 4 segundos
      let connected = false;
      let lastError = null;

      for (let attempt = 1; attempt <= 4; attempt++) {
        try {
          setStage({ s: "validating", d: `Ativando acesso (tentativa ${attempt}/4)...` });
          await login(targetServer, data.username, data.password, true, (s, d) => {
            if (mounted.current) setStage({ s, d });
          });
          connected = true;
          break;
        } catch (err) {
          lastError = err;
          if (attempt < 4) {
            await new Promise((resolve) => setTimeout(resolve, 4000));
          }
        }
      }

      if (!connected) {
        throw lastError || new Error("Conta criada, mas o servidor demorou a responder. Clique em ENTRAR.");
      }

      setTimeout(() => router.replace("/(tabs)"), 350);
    } catch (e: any) {
      if (mounted.current) {
        setError(e?.message || "Falha ao obter teste gratuito.");
        setStage(null);
      }
    } finally {
      if (mounted.current) {
        setTrialLoading(false);
        setLoading(false);
      }
    }
  };
